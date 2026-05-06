# To do list

## Docker

```bash
docker run -d \
  --name bthome \
  --restart always \
  --network host \
  --cap-add NET_RAW \
  --cap-add NET_ADMIN \
  --cap-add CAP_NET_BIND_SERVICE \
  -v /var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket:ro \
  -e TZ=Europe/Paris \
  luligu/matterbridge:latest \
  bash -lc ' \
  apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
  bluetooth bluez libbluetooth-dev libudev-dev \
  build-essential libcap2-bin curl ca-certificates \
  python3 python3-pip && \
  setcap "cap_net_raw,cap_net_admin,cap_net_bind_service+eip" "$(which node)" && \
  getcap "$(which node)" && \
  hciconfig -a && \
  hciconfig hci0 up && \
  echo "Setup complete — container ready for BLE scanning." && \
  matterbridge --docker --frontend 8585 --port 5597'
```

## Docker compose

```yaml
  ubuntu:
    container_name: bthome
    image: luligu/matterbridge:latest
    restart: always
    network_mode: host
    cap_add:
      - NET_RAW
      - NET_ADMIN
      - CAP_NET_BIND_SERVICE
    volumes:
      - "/var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket"
    environment:
      - TZ=Europe/Paris
    command: >
      bash -lc "
        apt-get update &&
        apt-get upgrade -y &&
        apt-get install -y --no-install-recommends bluetooth bluez libbluetooth-dev libudev-dev build-essential libcap2-bin curl ca-certificates python3 python3-pip &&
        setcap 'cap_net_raw,cap_net_admin,cap_net_bind_service+eip' "$(which node)" &&
        getcap "$(which node)" &&
        hciconfig -a &&
        hciconfig hci0 up &&
        echo 'Setup complete — dropping to interactive shell.' &&
        matterbridge --docker --frontend 8585 --port 5597
      "
```
