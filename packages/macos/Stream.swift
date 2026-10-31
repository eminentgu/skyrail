import Foundation
import AppKit
import ScreenCaptureKit
import CoreMedia
import CoreImage
import ImageIO
import UniformTypeIdentifiers

// Separate capture process: never reads AX or changes the agent's element indices.
final class WindowStream: NSObject, SCStreamOutput, SCStreamDelegate {
 let context=CIContext(options:[.cacheIntermediates:false])
 var stopped=false
 func stream(_ stream: SCStream, didStopWithError error: Error) { stopped=true; Self.status(["error":error.localizedDescription]) }
 static func status(_ value:[String:Any]) { if let data=try? JSONSerialization.data(withJSONObject:value) { FileHandle.standardError.write(data+Data([10])) } }
 func stream(_ stream:SCStream,didOutputSampleBuffer sample:CMSampleBuffer,of type:SCStreamOutputType) {
  guard type == .screen,sample.isValid,let buffer=sample.imageBuffer else { return }
  if let attachments=CMSampleBufferGetSampleAttachmentsArray(sample,createIfNecessary:false) as? [[SCStreamFrameInfo:Any]], let status=attachments.first?[.status] as? Int, status != SCFrameStatus.complete.rawValue { return }
  autoreleasepool {
   let ci=CIImage(cvPixelBuffer:buffer)
   guard let image=context.createCGImage(ci,from:ci.extent) else{return}
   let data=NSMutableData()
   guard let destination=CGImageDestinationCreateWithData(data,UTType.jpeg.identifier as CFString,1,nil) else{return}
   CGImageDestinationAddImage(destination,image,[kCGImageDestinationLossyCompressionQuality:0.72] as CFDictionary)
   guard CGImageDestinationFinalize(destination) else{return}
   var size=UInt32(data.length).bigEndian
   withUnsafeBytes(of:&size){FileHandle.standardOutput.write(Data($0))}
   FileHandle.standardOutput.write(data as Data)
  }
 }
 @MainActor static func capture(appID:String,windowID:UInt32?) async {
  do {
   guard CGPreflightScreenCaptureAccess() else {throw Failure(message:"屏幕录制未授权，请在系统设置中允许 Skyrail Mac")}
   let app=try appFor(appID)
   let content=try await SCShareableContent.excludingDesktopWindows(true,onScreenWindowsOnly:false)
   let windows=content.windows.filter{$0.owningApplication?.processID==app.processIdentifier && $0.windowLayer==0 && $0.frame.width>80 && $0.frame.height>80}
   guard let window=windows.first(where:{windowID == nil || $0.windowID==windowID}) else {throw Failure(message:"窗口已关闭，请重新连接应用")}
   let filter=SCContentFilter(desktopIndependentWindow:window)
   let config=SCStreamConfiguration()
   if #available(macOS 14.2,*) {config.ignoreShadowsSingleWindow=true}
   let scale=min(1,1600/window.frame.width)
   config.width=max(2,Int(window.frame.width*scale));config.height=max(2,Int(window.frame.height*scale))
   config.minimumFrameInterval=CMTime(value:1,timescale:15);config.queueDepth=3;config.showsCursor=true
   config.pixelFormat=kCVPixelFormatType_32BGRA
   let output=WindowStream();let stream=SCStream(filter:filter,configuration:config,delegate:output)
   try stream.addStreamOutput(output,type:.screen,sampleHandlerQueue:DispatchQueue(label:"skyrail.frames",qos:.userInteractive))
   try await stream.startCapture()
   status(["type":"started","width":config.width,"height":config.height,"windowId":window.windowID])
   while !output.stopped {try await Task.sleep(nanoseconds:1_000_000_000);status(["type":"heartbeat"])}
   try? await stream.stopCapture()
  }catch{status(["error":(error as? Failure)?.message ?? error.localizedDescription])}
 }
}
