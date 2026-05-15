#!/bin/sh
#
# Persistent SSH launcher - called by USBNet Upstart emergency hook on every boot
# Lives at: /mnt/us/usbnet/bin/emergency.sh
#
LOG="/mnt/us/ssh_persist.log"
KEYDIR="/mnt/us/usbnet/etc/dropbear"

echo "$(date) - Boot SSH starting" >> "$LOG"

# Already running? Exit early to avoid double-start
if pgrep dropbear > /dev/null 2>&1; then
    echo "$(date) - dropbear already running, skipping" >> "$LOG"
    exit 0
fi

mkdir -p "$KEYDIR"

# Generate key if missing (needs /usr/bin/dropbearkey symlink from ssh_enable.sh)
if [ ! -f "$KEYDIR/dropbear_rsa_host_key" ]; then
    echo "$(date) - Generating RSA host key..." >> "$LOG"
    /usr/bin/dropbearkey -t rsa -f "$KEYDIR/dropbear_rsa_host_key" >> "$LOG" 2>&1
fi

# Start SSH daemon on port 22
/usr/bin/dropbear -r "$KEYDIR/dropbear_rsa_host_key" -p 22 >> "$LOG" 2>&1
echo "$(date) - dropbear exit: $?" >> "$LOG"

# Start screensaver update loop in background (every 30 minutes)
SCRN_SCRIPT="/mnt/us/kindle-screensaver-update.sh"
if [ -f "$SCRN_SCRIPT" ]; then
    (
        while true; do
            sleep 1800
            sh "$SCRN_SCRIPT" >> /mnt/us/screensaver_cron.log 2>&1
        done
    ) &
    echo "$(date) - screensaver update loop started (every 30min)" >> "$LOG"
fi
