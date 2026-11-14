import Foundation
import Security

// Own-item credential storage only. Never query another application's items or
// show a Keychain modal during an unattended browser connection.
SecKeychainSetUserInteractionAllowed(false)
let service=ProcessInfo.processInfo.environment["SKYRAIL_CREDENTIAL_SERVICE"] ?? "local.skyrail.screen-sharing"
let method=CommandLine.arguments.dropFirst().first ?? "status"
func respond(_ value:[String:Any]) {
 if let bytes=try? JSONSerialization.data(withJSONObject:value) {FileHandle.standardOutput.write(bytes)}
}
guard service=="local.skyrail.screen-sharing" || service.hasPrefix("local.skyrail.test.") else {respond(["error":"Invalid credential service"]);exit(1)}
let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:"screen-sharing"]
var status:OSStatus=errSecParam
switch method {
case "status","get":
 var search=query;search[kSecMatchLimit as String]=kSecMatchLimitOne
 search[method=="get" ? kSecReturnData as String:kSecReturnAttributes as String]=true
 var result:CFTypeRef?;status=SecItemCopyMatching(search as CFDictionary,&result)
 if status==errSecItemNotFound {respond(["saved":false]);exit(0)}
 if status==errSecSuccess {
  if method=="get",let data=result as? Data,let value=try? JSONSerialization.jsonObject(with:data) as? [String:String] {respond(["saved":true,"credentials":value])}
  else {respond(["saved":true])};exit(0)
 }
case "set":
 let data=FileHandle.standardInput.readDataToEndOfFile()
 guard data.count<=10000,let value=try? JSONSerialization.jsonObject(with:data) as? [String:String],
  let username=value["username"],let password=value["password"],username.utf8.count<=512,!password.isEmpty,password.utf8.count<=4096,
  value.keys.allSatisfy({["username","password"].contains($0)}) else {respond(["error":"Invalid credentials"]);exit(1)}
 let update=[kSecValueData as String:data]
 status=SecItemUpdate(query as CFDictionary,update as CFDictionary)
 if status==errSecItemNotFound {var add=query;add[kSecValueData as String]=data;add[kSecAttrLabel as String]="Skyrail Screen Sharing";status=SecItemAdd(add as CFDictionary,nil)}
 if status==errSecSuccess {respond(["saved":true]);exit(0)}
case "delete":
 status=SecItemDelete(query as CFDictionary)
 if status==errSecSuccess || status==errSecItemNotFound {respond(["saved":false]);exit(0)}
default: break
}
respond(["error":"Keychain unavailable; use manual connection credentials","osStatus":Int(status)]);exit(1)
