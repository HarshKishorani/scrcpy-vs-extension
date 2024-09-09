const vscode = require("vscode");
const { WebUSB } = require("usb");
const fs = require("fs/promises");

let devices = [];

function identifyCodec(value) {
  switch (value) {
    case 0x68_32_36_34:
      console.log("The codec is H264");
      break;
    case 0x68_32_36_35:
      console.log("The codec is H265");
      break;
    case 0x00_61_76_31:
      console.log("The codec is AV1");
      break;
    default:
      console.log("Unknown codec");
  }
}

async function startServer(adb) {
  // Import Stuff
  const { AdbScrcpyClient, AdbScrcpyOptions2_1 } = await import(
    "@yume-chan/adb-scrcpy"
  );
  const { VERSION } = await import("@yume-chan/fetch-scrcpy-server");
  const { ScrcpyOptions2_3, DEFAULT_SERVER_PATH, CodecOptions } = await import(
    "@yume-chan/scrcpy"
  );

  // Start Server
  const options = new AdbScrcpyOptions2_1(
    new ScrcpyOptions2_3({
      // Uncomment for codec settings
      // codecOptions: new CodecOptions({
      //   profile: H264Capabilities.maxProfile,
      //   level: H264Capabilities.maxLevel,
      // }),
    })
  );

  const client = await AdbScrcpyClient.start(
    adb,
    DEFAULT_SERVER_PATH,
    // If server binary was downloaded manually, must provide the correct version
    VERSION,
    options
  );

  if (client) {
    vscode.window.showInformationMessage("Client Connected.");
  }

  return client;
}

async function pushScrcpyServer(adb) {
  // Import Stuff
  const { AdbScrcpyClient } = await import("@yume-chan/adb-scrcpy");
  const { ReadableStream } = await import("@yume-chan/stream-extra");
  const { BIN } = await import("@yume-chan/fetch-scrcpy-server");

  // Push server
  const server = await fs.readFile(BIN);

  await AdbScrcpyClient.pushServer(
    adb,
    new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(server));
        controller.close();
      },
    })
  );
}

async function connectDevice(selectedDevice) {
  // Import stuff
  const { CredentialStore } = await import("./credential_store.mjs");
  const { Adb, AdbDaemonTransport } = await import("@yume-chan/adb");

  // Connect to the device
  const device = devices[selectedDevice.index];
  const connection = await device.connect();
  const transport = await AdbDaemonTransport.authenticate({
    serial: device.serial,
    connection,
    credentialStore: CredentialStore,
  });

  // Create adb instance
  const adb = new Adb(transport);
  return adb;
}

async function getAndDisplayDevices() {
  // Import stuff
  const { AdbDaemonWebUsbDeviceManager } = await import(
    "@yume-chan/adb-daemon-webusb"
  );

  const Manager = new AdbDaemonWebUsbDeviceManager(
    new WebUSB({ allowAllDevices: true })
  );

  // Get Devices
  try {
    devices = [];
    devices = await Manager.getDevices();
    let deviceList = [];
    for (let i = 0; i < devices.length; i++) {
      let device = devices[i];
      deviceList.push({
        label: device.name,
        index: i,
      });
    }

    if (deviceList.length === 0) {
      vscode.window.showInformationMessage("No devices connected.");
    } else {
      const selectedDevice = await vscode.window.showQuickPick(deviceList, {
        placeHolder: "Select a device to view details",
      });

      return selectedDevice;
    }
  } catch (error) {
    console.error(error);
    vscode.window.showErrorMessage("Failed to retrieve devices.");
  }
}

function getWebviewContent(context) {
  return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ADB Device Video Stream</title>
</head>

<body>
</body>

</html>`;
}


async function startVideoStream(context) {
  // const { TinyH264Decoder } = await import("@yume-chan/scrcpy-decoder-tinyh264");
  // const decoder = new TinyH264Decoder();

  // Get and connect to device
  const selectedDevice = await getAndDisplayDevices();
  if (!selectedDevice) return;

  const adb = await connectDevice(selectedDevice);
  if (!adb) return;

  // Push Server
  await pushScrcpyServer(adb);

  // Start server
  const client = await startServer(adb);

  if (!client) {
    vscode.window.showErrorMessage("Failed to start scrcpy client");
    return;
  }

  // Create webview panel
  const panel = vscode.window.createWebviewPanel(
    "adbVideoStream",
    "ADB Device Video Stream",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)],
    }
  );

  // Set webview content
  panel.webview.html = getWebviewContent();

  // Set up video stream
  if (client.videoStream) {
    const { stream: videoPacketStream } = await client.videoStream;

    videoPacketStream
      .pipeTo(
        new WritableStream({
          async write(packet) {
            switch (packet.type) {
              case "data":
                panel.webview.postMessage({
                  type: "videoFrame",
                  frameData: packet.data, // Uint8Array
                });
                break;
            }
          },
        })
      )
      .catch((e) => {
        console.error(e);
      });
  }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "scrcpy" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with  registerCommand
  // The commandId parameter must match the command field in package.json

  let disposable = vscode.commands.registerCommand("scrcpy.startcopy", () => {
    startVideoStream(context);
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
