# To do list

```powershell
docker build -t bthome:latest .
```

## Docker build with powershell

```powershell
docker build --platform linux/arm64 -f Dockerfile.alpine -t matterbridge:edge .
```

```powershell
docker run -d --name matterbridge --restart always --network host -e TZ=Europe/Paris matterbridge:edge
```

## Docker with powershell

```powershell
docker run -it --name bthome `
  --cap-add NET_RAW `
  --cap-add NET_ADMIN `
  --cap-add CAP_NET_BIND_SERVICE `
  -e TZ=Europe/Paris `
  bthome:latest `
  bash -lc "tail -f /dev/null"
```

docker run -it --name bthome --cap-add NET_RAW --cap-add NET_ADMIN --cap-add CAP_NET_BIND_SERVICE -e TZ=Europe/Paris bthome:latest bash -lc "tail -f /dev/null"

## Docker

```bash
docker run -d \
 --name ubuntu \
 --restart always \
 --network host \
 --cap-add NET_RAW \
 --cap-add NET_ADMIN \
 --cap-add CAP_NET_BIND_SERVICE \
 -v /home/lligu/DockerShare:/root/DockerShare \
 -v /var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket:ro \
 -e TZ=Europe/Paris \
 ubuntu:latest \
 bash -lc 'apt-get update \
 && apt-get upgrade -y \
 && apt-get install -y --no-install-recommends \
 bluetooth bluez libbluetooth-dev libudev-dev \
 build-essential libcap2-bin curl ca-certificates \
 && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install npm@latest -g \
 && node -v && npm -v \
 && setcap "cap_net_raw,cap_net_admin,cap_net_bind_service+eip" "$(which node)" \
    && getcap "$(which node)" \
 && hciconfig -a \
 && hciconfig hci0 up \
 && echo "Setup complete — container ready for BLE scanning." \
 && tail -f /dev/null'
```

## Docker compose

```
  ubuntu:
    container_name: ubuntu
    image: ubuntu:latest
    restart: always
    network_mode: host
    cap_add:
      - NET_RAW
      - NET_ADMIN
      - CAP_NET_BIND_SERVICE
    volumes:
      - "/home/lligu/DockerShare:/root/DockerShare"
      - "/var/run/dbus/system_bus_socket:/var/run/dbus/system_bus_socket"
    environment:
      - TZ=Europe/Paris
    command: >
      bash -lc "
        apt-get update &&
        apt-get upgrade -y &&
        apt-get install -y --no-install-recommends bluetooth bluez libbluetooth-dev libudev-dev build-essential libcap2-bin curl ca-certificates &&
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash - &&
        apt-get install -y --no-install-recommends nodejs &&
        npm install npm@latest -g &&
        node -v &&
        npm -v &&
        setcap 'cap_net_raw,cap_net_admin,cap_net_bind_service+eip' "$(which node)" &&
        getcap "$(which node)" &&
        hciconfig -a &&
        hciconfig hci0 up &&
        echo 'Setup complete — dropping to interactive shell.' &&
        tail -f /dev/null
      "
```
