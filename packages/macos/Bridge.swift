import Foundation
import AppKit
import ApplicationServices
import ScreenCaptureKit
import ImageIO
import UniformTypeIdentifiers

struct Failure: Error { let message: String }
func fail(_ message: String) throws -> Never { throw Failure(message: message) }
func ax(_ element: AXUIElement, _ attr: String) -> CFTypeRef? { var value: CFTypeRef?; AXUIElementCopyAttributeValue(element,attr as CFString,&value); return value }
func text(_ element: AXUIElement,_ attr: String)->String { (ax(element,attr) as? String) ?? "" }
var elements: [AXUIElement] = []
var observedApp = ""
func walk(_ element: AXUIElement,_ depth: Int,_ lines: inout [String]) {
 if depth>8 || elements.count>=500 { return }
 let index=elements.count;elements.append(element)
 let role=text(element,kAXRoleAttribute), title=text(element,kAXTitleAttribute)+" "+text(element,kAXDescriptionAttribute), value=text(element,kAXValueAttribute)
 lines.append("\(index) \(String(repeating:" ",count:depth))\(role) \(title) \(value.prefix(200))")
 if let children=ax(element,kAXChildrenAttribute) as? [AXUIElement] { for child in children { walk(child,depth+1,&lines) } }
}
func appFor(_ id: String) throws -> NSRunningApplication {
 guard let app=NSRunningApplication.runningApplications(withBundleIdentifier:id).first else { try fail("应用未运行，请先打开它") };return app
}
var heldMouse: (pid:pid_t,point:CGPoint,button:CGMouseButton)?
var heldRelease:(()->Void)?
var pointerStart:CGPoint?
var pointerDragged=false
var heldKeys: [CGKeyCode:pid_t] = [:]
func releaseInput() {
 heldRelease?();heldRelease=nil;heldMouse=nil;pointerStart=nil;pointerDragged=false
 for (key,pid) in heldKeys { CGEvent(keyboardEventSource:nil,virtualKey:key,keyDown:false)?.postToPid(pid) };heldKeys=[:]
}
func eventFlags(_ req:[String:Any])->CGEventFlags {
 var flags=CGEventFlags();if req["shift"] as? Bool == true {flags.insert(.maskShift)};if req["meta"] as? Bool == true {flags.insert(.maskCommand)};if req["ctrl"] as? Bool == true {flags.insert(.maskControl)};if req["alt"] as? Bool == true {flags.insert(.maskAlternate)};return flags
}
func elementRect(_ element:AXUIElement)->CGRect? {
 guard let p=ax(element,kAXPositionAttribute),let s=ax(element,kAXSizeAttribute),CFGetTypeID(p)==AXValueGetTypeID(),CFGetTypeID(s)==AXValueGetTypeID() else {return nil}
 var point=CGPoint.zero;var size=CGSize.zero
 guard AXValueGetValue(p as! AXValue,.cgPoint,&point),AXValueGetValue(s as! AXValue,.cgSize,&size) else {return nil}
 return CGRect(origin:point,size:size)
}
func pressByWindowGeometry(app:NSRunningApplication,window:SCWindow,x:Double,y:Double)->Bool {
 let root=AXUIElementCreateApplication(app.processIdentifier)
 guard let windows=ax(root,kAXWindowsAttribute) as? [AXUIElement] else {return false}
 // AX windows retain their own geometry even when the viewer enters another Space.
 let candidates=windows.compactMap { element -> (AXUIElement,CGRect,Double)? in
  guard let rect=elementRect(element) else{return nil}
  let titlePenalty=text(element,kAXTitleAttribute)==(window.title ?? "") ? 0.0:10000.0
  return (element,rect,titlePenalty+abs(rect.width-window.frame.width)+abs(rect.height-window.frame.height))
 }.sorted{$0.2<$1.2}
 guard let target=candidates.first else{return false}
 let point=CGPoint(x:target.1.minX+x*target.1.width,y:target.1.minY+y*target.1.height)
 var hits:[(AXUIElement,CGFloat)]=[];var count=0
 func visit(_ element:AXUIElement,_ depth:Int){
  count+=1;if count>2500||depth>22{return}
  if let rect=elementRect(element),rect.width>0,rect.height>0,rect.contains(point) {hits.append((element,rect.width*rect.height))}
  if let children=ax(element,kAXChildrenAttribute) as? [AXUIElement] {for child in children {visit(child,depth+1)}}
 }
 visit(target.0,0)
 for (element,_) in hits.sorted(by:{$0.1<$1.1}) {
  if AXUIElementPerformAction(element,kAXPressAction as CFString) == .success {return true}
  let role=text(element,kAXRoleAttribute)
  if [kAXTextFieldRole,kAXTextAreaRole,kAXComboBoxRole].contains(role),AXUIElementSetAttributeValue(element,kAXFocusedAttribute as CFString,kCFBooleanTrue) == .success {return true}
 }
 return false
}
func humanInput(_ req:[String:Any],app:NSRunningApplication) async throws -> [String:Any] {
 let kind=req["kind"] as? String ?? ""
 if kind=="text" {
  let value=req["text"] as? String ?? "";guard value.utf16.count<=4000 else {try fail("单次输入过长")};let chars=Array(value.utf16)
  for down in [true,false] {let event=CGEvent(keyboardEventSource:nil,virtualKey:0,keyDown:down);chars.withUnsafeBufferPointer {if let base=$0.baseAddress {event?.keyboardSetUnicodeString(stringLength:chars.count,unicodeString:base)}};event?.postToPid(app.processIdentifier)};return ["ok":true]
 }
 if kind=="key" {
  let map:[String:CGKeyCode] = ["Enter":36,"Tab":48,"Escape":53,"Backspace":51,"Delete":117,"ArrowLeft":123,"ArrowRight":124,"ArrowDown":125,"ArrowUp":126,"Home":115,"End":119,"PageUp":116,"PageDown":121,"Space":49,"KeyA":0,"KeyS":1,"KeyD":2,"KeyF":3,"KeyH":4,"KeyG":5,"KeyZ":6,"KeyX":7,"KeyC":8,"KeyV":9,"KeyB":11,"KeyQ":12,"KeyW":13,"KeyE":14,"KeyR":15,"KeyY":16,"KeyT":17,"KeyO":31,"KeyU":32,"KeyI":34,"KeyP":35,"KeyL":37,"KeyJ":38,"KeyK":40,"KeyN":45,"KeyM":46]
  guard let code=map[req["code"] as? String ?? ""] else {try fail("暂不支持此快捷键")}
  for down in [true,false] {let event=CGEvent(keyboardEventSource:nil,virtualKey:code,keyDown:down);event?.flags=eventFlags(req);event?.postToPid(app.processIdentifier)};return ["ok":true]
 }
 let content=try await SCShareableContent.excludingDesktopWindows(true,onScreenWindowsOnly:false)
 guard let id=req["windowId"] as? UInt32,let window=content.windows.first(where:{$0.windowID==id && $0.owningApplication?.processID==app.processIdentifier}) else {try fail("窗口已关闭或更换，请重新连接")}
 guard let x=req["x"] as? Double,let y=req["y"] as? Double,x.isFinite,y.isFinite,(0...1).contains(x),(0...1).contains(y) else {try fail("输入坐标无效")}
 let point=CGPoint(x:window.frame.minX+x*window.frame.width,y:window.frame.minY+y*window.frame.height)
 if kind=="scroll" {
  let dx=max(-500,min(500,req["deltaX"] as? Int ?? 0)),dy=max(-500,min(500,req["deltaY"] as? Int ?? 0))
  let event=CGEvent(scrollWheelEvent2Source:nil,units:.pixel,wheelCount:2,wheel1:Int32(-dy),wheel2:Int32(-dx),wheel3:0);event?.location=point;event?.postToPid(app.processIdentifier);return ["ok":true]
 }
 let button:CGMouseButton=(req["button"] as? Int == 2) ? .right : .left
 if kind=="down" {pointerStart=point;pointerDragged=false;heldMouse=(app.processIdentifier,point,button);return ["ok":true]}
 func postMouse(_ type:NSEvent.EventType,_ target:CGPoint) {
  let local=CGPoint(x:target.x-window.frame.minX,y:window.frame.height-(target.y-window.frame.minY))
  let event=NSEvent.mouseEvent(with:type,location:local,modifierFlags:NSEvent.ModifierFlags(rawValue:UInt(eventFlags(req).rawValue)),timestamp:ProcessInfo.processInfo.systemUptime,windowNumber:Int(id),context:nil,eventNumber:0,clickCount:req["clickCount"] as? Int ?? 1,pressure:type == .leftMouseUp || type == .rightMouseUp ? 0:1)
  event?.cgEvent?.postToPid(app.processIdentifier)
 }
 if kind=="move" {
  guard let start=pointerStart else {return ["ok":true]}
  if !pointerDragged && hypot(point.x-start.x,point.y-start.y)<3 {return ["ok":true]}
  if !pointerDragged {postMouse(button == .right ? .rightMouseDown:.leftMouseDown,start);pointerDragged=true}
  postMouse(button == .right ? .rightMouseDragged:.leftMouseDragged,point);heldRelease={postMouse(button == .right ? .rightMouseUp:.leftMouseUp,point)};heldMouse=(app.processIdentifier,point,button);return ["ok":true]
 }
 guard kind=="up" else {try fail("无效输入类型")}
 defer {heldRelease=nil;heldMouse=nil;pointerStart=nil;pointerDragged=false}
 if !pointerDragged && button == .left {
  if pressByWindowGeometry(app:app,window:window,x:x,y:y) {return ["ok":true,"route":"window-ax-geometry"]}
  // Coordinate click is resolved against this app's accessibility tree, including
  // background windows. Public PID mouse posting alone is ignored by some apps.
  var hit:AXUIElement?
  let appElement=AXUIElementCreateApplication(app.processIdentifier)
  if AXUIElementCopyElementAtPosition(appElement,Float(point.x),Float(point.y),&hit) == .success {
   var candidate=hit
   for _ in 0..<5 {
    guard let element=candidate else {break}
    if AXUIElementPerformAction(element,kAXPressAction as CFString) == .success {return ["ok":true,"route":"accessibility"]}
    guard let parent=ax(element,kAXParentAttribute),CFGetTypeID(parent)==AXUIElementGetTypeID() else {break}
    candidate=(parent as! AXUIElement)
   }
  }
 }
 if !pointerDragged {postMouse(button == .right ? .rightMouseDown:.leftMouseDown,pointerStart ?? point)}
 postMouse(button == .right ? .rightMouseUp:.leftMouseUp,point)
 return ["ok":true,"route":"window-event"]

}
func run(_ req: [String:Any]) async throws -> [String:Any] {
 let method=req["method"] as? String ?? ""
 if method=="health" { return ["accessibility":AXIsProcessTrusted(),"screenRecording":CGPreflightScreenCaptureAccess(),"platform":"macos"] }
 if method=="requestPermissions" {
  let options=[kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String:true] as CFDictionary
  let trusted=AXIsProcessTrustedWithOptions(options)
  let screen=CGRequestScreenCaptureAccess()
  return ["accessibility":trusted,"screenRecording":screen]
 }
 if method=="openApp" {
  let requested=req["app"] as? String ?? ""
  let aliases=["计算器":"com.apple.calculator","本机计算器":"com.apple.calculator","calculator":"com.apple.calculator"]
  let name=aliases[requested.lowercased()] ?? requested
  let url=NSWorkspace.shared.urlForApplication(withBundleIdentifier:name) ?? NSWorkspace.shared.fullPath(forApplication:name).map{URL(fileURLWithPath:$0)}
  guard let url=url else {try fail("找不到此应用，请使用已安装应用的名称或 bundle ID")}
  let configuration=NSWorkspace.OpenConfiguration();configuration.activates=false
  let launched=try await NSWorkspace.shared.openApplication(at:url,configuration:configuration)
  return ["app":launched.bundleIdentifier ?? name,"name":launched.localizedName ?? requested]
 }
 if method=="apps" { return ["apps":NSWorkspace.shared.runningApplications.filter{$0.activationPolicy == .regular && $0.bundleIdentifier != nil}.map{["id":$0.bundleIdentifier!,"name":$0.localizedName ?? $0.bundleIdentifier!]}] }
 if method=="releaseInput" {releaseInput();return ["ok":true]}
 let appID=req["app"] as? String ?? "";let app=try appFor(appID)
 if method=="windows" {
  guard CGPreflightScreenCaptureAccess() else { try fail("请先授予屏幕录制权限") }
  let content=try await SCShareableContent.excludingDesktopWindows(true,onScreenWindowsOnly:false)
  return ["windows":content.windows.filter{$0.owningApplication?.processID==app.processIdentifier && $0.windowLayer==0 && $0.frame.width>80 && $0.frame.height>80}.map{["id":$0.windowID,"title":$0.title ?? "未命名窗口","width":Int($0.frame.width),"height":Int($0.frame.height)]}]
 }
 if method=="observe" {
  guard CGPreflightScreenCaptureAccess() else { try fail("请在系统设置中授予屏幕录制权限，然后重新启动 Skyrail") }
  let content=try await SCShareableContent.excludingDesktopWindows(true,onScreenWindowsOnly:false)
  guard let window=content.windows.first(where:{$0.owningApplication?.processID==app.processIdentifier && $0.windowLayer==0 && $0.frame.width>80 && $0.frame.height>80 && ((req["windowId"] as? UInt32) == nil || $0.windowID == req["windowId"] as? UInt32)}) else { try fail("没有可捕获的应用窗口，请打开窗口后重试") }
  let filter=SCContentFilter(desktopIndependentWindow:window)
  let config=SCStreamConfiguration();if #available(macOS 14.2,*) {config.ignoreShadowsSingleWindow=true};config.width=Int(window.frame.width);config.height=Int(window.frame.height);config.showsCursor=true
  let image=try await SCScreenshotManager.captureImage(contentFilter:filter,configuration:config)
  let bytes=NSMutableData();guard let dest=CGImageDestinationCreateWithData(bytes,UTType.png.identifier as CFString,1,nil) else { try fail("图像编码失败") };CGImageDestinationAddImage(dest,image,nil);CGImageDestinationFinalize(dest)
  elements=[];observedApp=appID;var lines=[String]();if AXIsProcessTrusted() { walk(AXUIElementCreateApplication(app.processIdentifier),0,&lines) } else { lines.append("辅助功能未授权；仅观看，不可操作") }
  return ["text":lines.joined(separator:"\n"),"image":"data:image/png;base64,"+(bytes as Data).base64EncodedString(),"windowTitle":window.title ?? "","windowId":window.windowID,"width":config.width,"height":config.height,"capturedAt":ISO8601DateFormatter().string(from:Date())]
 }
 guard AXIsProcessTrusted() else { try fail("请在系统设置中为 Skyrail 授予辅助功能权限，然后重新检测") }
 if method=="humanInput" {return try await humanInput(req,app:app)}
 guard observedApp==appID else { try fail("请先观察当前应用再操作") }
 if method=="press" {
  let index=req["index"] as? Int ?? -1;guard elements.indices.contains(index) else { try fail("元素编号无效，请重新观察") }
  guard AXUIElementPerformAction(elements[index],kAXPressAction as CFString) == .success else { try fail("此元素不支持按下操作，请选择其他元素") };return ["ok":true]
 }
 if method=="setValue" {
  let index=req["index"] as? Int ?? -1;guard elements.indices.contains(index) else { try fail("元素编号无效，请重新观察") }
  guard AXUIElementSetAttributeValue(elements[index],kAXValueAttribute as CFString,(req["value"] as? String ?? "") as CFString) == .success else { try fail("元素不可编辑") };return ["ok":true]
 }
 if method=="key" {
  let codes:[String:CGKeyCode] = ["Return":36,"Tab":48,"Escape":53,"BackSpace":51,"Left":123,"Right":124,"Down":125,"Up":126]
  guard let code=codes[req["key"] as? String ?? ""] else { try fail("不支持的按键") }
  for down in [true,false] { let event=CGEvent(keyboardEventSource:nil,virtualKey:code,keyDown:down);event?.postToPid(app.processIdentifier) };return ["ok":true]
 }
 try fail("未知方法")
}
@main struct Bridge {
 @MainActor static func main() async {
  _ = NSApplication.shared
  if CommandLine.arguments.count >= 3 && CommandLine.arguments[1] == "--run-service" {
   let root=CommandLine.arguments[2];let process=Process()
   process.executableURL=URL(fileURLWithPath:ProcessInfo.processInfo.environment["SKYRAIL_NODE"] ?? "/usr/bin/node")
   process.arguments=[root+"/apps/local-service/server.mjs"];process.currentDirectoryURL=URL(fileURLWithPath:root)
   process.standardOutput=FileHandle.standardOutput;process.standardError=FileHandle.standardError
   do {try process.run();process.waitUntilExit();exit(process.terminationStatus)}catch{fputs("Skyrail service could not start\n",stderr);exit(1)}
  }
  if CommandLine.arguments.count >= 3 && CommandLine.arguments[1] == "--stream" {
   let id=CommandLine.arguments.count>3 ? UInt32(CommandLine.arguments[3]) : nil
   await WindowStream.capture(appID:CommandLine.arguments[2],windowID:id);return
  }
  defer { releaseInput() }
  while let line=readLine() {
   var result:[String:Any]
   do { guard let req=try JSONSerialization.jsonObject(with:Data(line.utf8)) as? [String:Any] else { throw Failure(message:"无效请求") };result=try await run(req) }
   catch { result=["error":(error as? Failure)?.message ?? error.localizedDescription] }
   if let data=try? JSONSerialization.data(withJSONObject:result),let output=String(data:data,encoding:.utf8) { print(output);fflush(stdout) }
  }
 }
}
