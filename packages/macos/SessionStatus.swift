import Foundation
import CoreGraphics
@main struct SessionStatus {
 static func main(){
  let session=CGSessionCopyCurrentDictionary() as? [String:Any]
  let value:[String:Any] = ["locked":session == nil || session?["CGSSessionScreenIsLocked"] as? Bool == true,"available":session != nil]
  if let data=try? JSONSerialization.data(withJSONObject:value) {FileHandle.standardOutput.write(data)}
 }
}
