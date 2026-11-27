import UIKit
import Capacitor
import WebKit

/// The app's main screen: Capacitor's web view, plus the small native plugins that live in this app.
class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PrintPlugin())
    }
}

/// Prints the stock list and recipe cards with the iPhone's own print sheet (AirPrint, or Save to PDF).
@objc(PrintPlugin)
public class PrintPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "PrintPlugin"
    public let jsName = "Print"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "printHtml", returnType: CAPPluginReturnPromise)
    ]

    private var printView: WKWebView?
    private var pendingCall: CAPPluginCall?

    @objc func printHtml(_ call: CAPPluginCall) {
        guard let html = call.getString("html") else {
            call.reject("No page to print")
            return
        }
        DispatchQueue.main.async {
            if let earlier = self.pendingCall { earlier.resolve(["printed": false]) }
            self.pendingCall = call
            // Lay the page out in an off-screen A4-width web view, then print what it drew.
            let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 794, height: 1123))
            view.navigationDelegate = self
            self.printView = view
            view.loadHTMLString(html, baseURL: nil)
        }
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard webView === printView, let call = pendingCall else { return }
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = .general
        info.jobName = call.getString("name") ?? "Pantry Prep"
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printFormatter = webView.viewPrintFormatter()
        controller.present(animated: true) { _, completed, error in
            self.printView = nil
            self.pendingCall = nil
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["printed": completed])
            }
        }
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard webView === printView, let call = pendingCall else { return }
        printView = nil
        pendingCall = nil
        call.reject(error.localizedDescription)
    }
}
