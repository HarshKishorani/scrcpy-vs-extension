const vscode = require("vscode");
const { WebUSB } = require("usb");

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
      vscode.window.showInformationMessage("Fetching connected devices...");

      // Get Devices
      (async () => {
        const { AdbDaemonWebUsbDeviceManager } = await import(
          "@yume-chan/adb-daemon-webusb"
        );

        const Manager = new AdbDaemonWebUsbDeviceManager(
          new WebUSB({ allowAllDevices: true })
        );

        try {
          const devices = await Manager.getDevices();
          let deviceList = devices.map((device) => ({
            label: device.name,
            description: device.productName,
            detail: device.serialNumber,
          }));

          if (deviceList.length === 0) {
            vscode.window.showInformationMessage("No devices connected.");
          } else {
            const selectedDevice = await vscode.window.showQuickPick(
              deviceList,
              {
                placeHolder: "Select a device to view details",
              }
            );

            if (selectedDevice) {
              vscode.window.showInformationMessage(
                `Device Selected: ${selectedDevice.label} (${selectedDevice.description})`
              );
            }
          }
        } catch (error) {
          console.error(error);
          vscode.window.showErrorMessage("Failed to retrieve devices.");
        }
      })();
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
