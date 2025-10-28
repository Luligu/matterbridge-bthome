# <img src="matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge BTHome plugin

[![npm version](https://img.shields.io/npm/v/matterbridge-bthome.svg)](https://www.npmjs.com/package/matterbridge-bthome)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-bthome.svg)](https://www.npmjs.com/package/matterbridge-bthome)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-bthome/actions/workflows/build-matterbridge-plugin.yml/badge.svg)

[![power by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

This plugin allows you to expose any BTHome device to Matter using the native bluetooth adapter of the host machine.

Features:

- The bluetooth works correctly on all platforms and is based on the @stoprocent fork of noble.
- The discovered BTHome are stored with all attributes to easily restart the plugin.
- The plugin has also a command line **bthome** to test and verify the bluetooth adapter and the ble network.

If you like this project and find it useful, please consider giving it a star on GitHub at https://github.com/Luligu/matterbridge-bthome and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub">
  <img src="bmc-button.svg" alt="Buy me a coffee" width="120">
</a>

## Prerequisites

### Matterbridge

Follow these steps to install or update Matterbridge if it is not already installed and up to date:

```bash
npm install -g matterbridge --omit=dev
```

on Linux you may need the necessary permissions:

```bash
sudo npm install -g matterbridge --omit=dev
```

See the complete guidelines on [Matterbridge](https://github.com/Luligu/matterbridge/blob/main/README.md) for more information.

## Windows prerequisites

### Verify that node and npm are installed and updated

```powershell
node -v
npm -v
```

### Install the build toolchain + Python

```powershell
npm install --global --production windows-build-tools
```

## Ubuntu prerequisites

### System update (optional)

```bash
sudo apt update && sudo apt upgrade -y
```

### System update to use bluetooth

Run this command to update your system and add all the required components to use bluetooth.

```bash
sudo apt-get update
sudo apt-get install -y \
  bluetooth \
  bluez \
  libbluetooth-dev \
  libudev-dev \
  build-essential
```

### Check that the Bluetooth service is running

```bash
sudo systemctl status bluetooth
```

Should log something like:

```
● bluetooth.service - Bluetooth service
     Loaded: loaded (/lib/systemd/system/bluetooth.service; enabled; preset: enabled)
     Active: active (running) since Fri 2025-04-25 09:17:09 CEST; 23h ago
       Docs: man:bluetoothd(8)
   Main PID: 436 (bluetoothd)
     Status: "Running"
      Tasks: 1 (limit: 484)
     Memory: 1.6M
        CPU: 451ms
     CGroup: /system.slice/bluetooth.service
             └─436 /usr/libexec/bluetooth/bluetoothd
```

### Show your HCI adapter(s)

```bash
hciconfig -a
```

Should log something like:

```
hci0:   Type: Primary  Bus: UART
        BD Address: 50:41:1C:64:99:A1  ACL MTU: 1021:8  SCO MTU: 64:1
        UP RUNNING
        RX bytes:2213001 acl:0 sco:0 events:66361 errors:0
        TX bytes:38149 acl:0 sco:0 commands:270 errors:0
        Features: 0xbf 0xfe 0xcf 0xfe 0xdb 0xff 0x7b 0x87
        Packet type: DM1 DM3 DM5 DH1 DH3 DH5 HV1 HV2 HV3
        Link policy: RSWITCH SNIFF
        Link mode: PERIPHERAL ACCEPT
        Name: 'rock-s0'
        Class: 0x000000
        Service Classes: Unspecified
        Device Class: Miscellaneous,
        HCI Version: 4.0 (0x6)  Revision: 0x6a
        LMP Version: 4.0 (0x6)  Subversion: 0x2209
        Manufacturer: Broadcom Corporation (15)
```

### Use bluetoothctl to power on and scan to verify that the host machine adapter works correctly:

```bash
bluetoothctl
```

Commands:

- list
- power on
- scan on
- exit

list should log:

```
[bluetooth]# list
Controller 50:41:1C:64:E8:BB matterbridge [default]
```

list should log:

```
[bluetooth]# list
Controller 50:41:1C:64:E8:BB matterbridge [default]
```

power on should log:

```
[bluetooth]# power on
Changing power on succeeded
```

power on should log all the ble devices discovered:

```
[bluetooth]# scan on
Discovery started
[CHG] Controller 50:41:1C:64:E8:BB Discovering: yes
[NEW] Device 48:65:18:BE:BD:7D 48-65-18-BE-BD-7D
[NEW] Device 34:CD:B0:77:BC:D6 ShellyBluGwG3-34CDB077BCD4
[NEW] Device CC:D2:81:73:08:9F CC-D2-81-73-08-9F
[NEW] Device 7C:2E:9D:5D:34:FB 7C-2E-9D-5D-34-FB
[NEW] Device EC:62:60:8A:B9:A6 ShellyPro1PM-EC62608AB9A4
[NEW] Device B0:B2:1C:FA:AD:1A ShellyBluGw-B0B21CFAAD18
```

enter exit to exit

```
exit
```

### Set the permission to open raw BLE sockets

You must grant all caps in a single setcap call (otherwise one call will overwrite the previous).

Upgrading or reinstalling Node will clear these caps, so you should re-run the setcap command after any Node.js update.

```bash
sudo setcap 'cap_net_raw,cap_net_admin+eip' "$(which node)"
```

cap_net_raw lets a process open raw network sockets (required by Noble to talk directly to the Bluetooth HCI device).
cap_net_admin gives it basic network administration rights (e.g. bringing interfaces up/down, required by some BLE drivers).
+eip means these capabilities are set in the process’s Effective, Inheritable, and Permitted sets so that any child processes you spawn also inherit them.

### Set the permissions to to open raw BLE sockets and to bind to port 443 without root (if you use the frentend with -ssl)

You must grant all caps in a single setcap call (otherwise one call will overwrite the previous).

Upgrading or reinstalling Node will clear these caps, so you should re-run the setcap command after any Node.js update.

```bash
sudo setcap 'cap_net_raw,cap_net_admin,cap_net_bind_service+eip' "$(which node)"
```

cap_net_raw lets a process open raw network sockets (required by Noble to talk directly to the Bluetooth HCI device).
cap_net_admin gives it basic network administration rights (e.g. bringing interfaces up/down, required by some BLE drivers).
cap_net_bind_service allows binding to privileged ports (<1024), like 443, even when you run node as an unprivileged user.
+eip means these capabilities are set in the process’s Effective, Inheritable, and Permitted sets so that any child processes you spawn also inherit them.

### Get the current permissions

```bash
getcap "$(which node)"
```

### Set the permissions if you use systemctl to run matterbridge

Add this to your systemctl service

```
[Service]
AmbientCapabilities=CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_NET_ADMIN
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_NET_ADMIN
```

What this does
CAP_NET_RAW + CAP_NET_ADMIN let Noble open raw HCI sockets for BLE.
CAP_NET_BIND_SERVICE lets Node bind to port 443.
AmbientCapabilities makes those caps effective in the service process.
CapabilityBoundingSet removes all other Linux capabilities for extra safety.

After execute this to apply the changes

```bash
sudo systemctl daemon-reload
sudo systemctl restart matterbridge.service
```

## Install or reinstall, if you already installed it, the plugin

From the frontend select matterbridge-bthome and hit Install.

Then restart.

Or if you prefer to install it manually

```bash
sudo npm install matterbridge-bthome --global --omit=dev --verbose
```

This is mandatory because noble builds the bluetooth package on the host machine.

## Test the plugin bluetooth scanner from the command line

```bash
bthome --scan --bthome
```

```markdown
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Parameter     | Description                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `--scan`      | Activate the scanner                                                                                                   |
| `--bthome`    | Enable the filter for BTHome devices                                                                                   |
| `--shellyble` | Enable the filter for Shelly devices with BLE component enabled                                                        |
| `--address`   | Enable the filter for MAC address (e.g., `bthome --scan --address 28:68:47:fc:9a:6b 28:db:a7:b5:d1:ca --logger debug`) |
| `--logger`    | Set the logging level (e.g., `debug`, `info`, `notice`, ...)                                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
```
