#!/bin/sh
#
# SSH WiFi Enabler for Kindle 8th Gen (Jailbroken)
# Triggered via Mesquito app + com.lab126.transfer source_command
# Runs as root - installs dropbear SSH and makes it persistent on boot
#
LOG="/mnt/us/ssh_enable.log"
USBNET_DIR="/mnt/us/usbnet"
KEYDIR="$USBNET_DIR/etc/dropbear"

echo "" >> "$LOG"
echo "=== SSH Enable: $(date) ===" >> "$LOG"

# --- Step 0: Set root password ---
echo "root:mario" | chpasswd 2>> "$LOG" && echo "Step 0: root password set to 'mario'" >> "$LOG" || echo "Step 0: chpasswd failed" >> "$LOG"

# --- Step 1: Make dropbearmulti executable ---
chmod +x "$USBNET_DIR/bin/dropbearmulti" 2>> "$LOG"
echo "Step 1: chmod dropbearmulti done" >> "$LOG"

# --- Step 2: Mount rootfs writable, install symlinks + upstart confs ---
mntroot rw >> "$LOG" 2>&1
echo "Step 2: mntroot rw done" >> "$LOG"

# Create dropbear/dropbearkey symlinks on system partition (ext2 supports symlinks)
ln -sf /mnt/us/usbnet/bin/dropbearmulti /usr/bin/dropbear 2>> "$LOG"
ln -sf /mnt/us/usbnet/bin/dropbearmulti /usr/bin/dropbearkey 2>> "$LOG"
echo "Step 2: symlinks created" >> "$LOG"

# Install Upstart job configs for persistent SSH on every boot
# usbnet.conf: runs after volumd starts (when WiFi/network is ready)
# Checks for emergency.sh in /mnt/us/usbnet/bin/ and runs it
cp -f /mnt/us/usbnet.conf /etc/upstart/usbnet.conf 2>> "$LOG" && echo "Step 2: usbnet.conf installed" >> "$LOG"
cp -f /mnt/us/usbnet-preinit.conf /etc/upstart/usbnet-preinit.conf 2>> "$LOG" && echo "Step 2: usbnet-preinit.conf installed" >> "$LOG"

mntroot ro >> "$LOG" 2>&1
echo "Step 2: mntroot ro done" >> "$LOG"

# --- Step 3: Generate SSH host keys ---
mkdir -p "$KEYDIR"
if [ ! -f "$KEYDIR/dropbear_rsa_host_key" ]; then
    echo "Step 3: Generating RSA host key..." >> "$LOG"
    /usr/bin/dropbearkey -t rsa -f "$KEYDIR/dropbear_rsa_host_key" >> "$LOG" 2>&1
    echo "Step 3: keygen exit: $?" >> "$LOG"
else
    echo "Step 3: RSA host key already exists" >> "$LOG"
fi

# --- Step 4: Kill any existing dropbear and start fresh ---
pkill -9 dropbear 2>/dev/null
sleep 1

echo "Step 4: Starting dropbear SSH on port 22..." >> "$LOG"
/usr/bin/dropbear -r "$KEYDIR/dropbear_rsa_host_key" -p 22 >> "$LOG" 2>&1
echo "Step 4: dropbear exit code: $?" >> "$LOG"

sleep 2

# Verify SSH is running
if pgrep dropbear > /dev/null 2>&1; then
    echo "SUCCESS: SSH daemon is running on port 22" >> "$LOG"
    echo "Connect with: ssh root@<kindle_wifi_ip>" >> "$LOG"
    echo "Default password: mario" >> "$LOG"
else
    echo "FAIL: SSH daemon not running - check log above" >> "$LOG"
fi

echo "=== Done: $(date) ===" >> "$LOG"
