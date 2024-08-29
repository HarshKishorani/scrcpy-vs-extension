// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
const { WebUSB } = require("usb");

async function importstuff() {
  try {
    const { AdbDaemonWebUsbDeviceManager } = await import(
      "@yume-chan/adb-daemon-webusb"
    );
    const { Adb, AdbDaemonTransport } = await import("@yume-chan/adb");
    const CredentialStore = await import("./credential_store.mjs");

    const WebUsb = new WebUSB({ allowAllDevices: true });
    const Manager = new AdbDaemonWebUsbDeviceManager(WebUsb);

    // Get all ADB access android Devices.
    const devices = await Manager.getDevices();
    vscode.window.showInformationMessage(
      "ADB devices found : " + devices.length
    );

    // Connect to the device
    if (devices.length != 0) {
      const device = devices[0];
      const connection = await device.connect();

      // Create ADB Transport
      const transport = await AdbDaemonTransport.authenticate({
        serial: device.serial,
        connection,
        credentialStore: CredentialStore,
      });

      // Create adb instance
      const adb = new Adb(transport);

      // Take screenshot in device
      const screenshot = await adb.framebuffer();

      // Create Image data
      const imageData = new ImageData(
        new Uint8ClampedArray(screenshot.data),
        screenshot.width,
        screenshot.height
      );

      vscode.window.showInformationMessage(
        "Screenshot taken."
      );
    }
  } catch (error) {
    console.error("Failed to connect ADB device:", error);
    vscode.window.showErrorMessage("Failed to connect ADB device.");
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "scrcpy" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "scrcpy.helloWorld",
    function () {
      // The code you place here will be executed every time your command is executed

      // Display a message box to the user
      vscode.window.showInformationMessage("Hello World from Screen-Copy!");

      importstuff();
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
