---
title: "DHCP và DNS"
description: "Configure DHCP on Windows Server in a VMware NAT network, test a Lubuntu client, and understand forward/reverse lookup zones."
platform: "Windows Server"
category: "Networking"
difficulty: "Easy"
publishedAt: 2026-08-22
tags: ["dhcp", "dns", "windows-server", "vmware", "lubuntu", "forward-lookup", "reverse-lookup"]
language: "en"
translationKey: "windows-server/dhcp-va-dns"
draft: false
featured: false
cover: "/images/dhcp-va-dns/dhcp-dns-01.png"
---

> This write-up records an internal lab using VMware, Windows Server, and Lubuntu. The IP addresses below belong to this lab; replace them when deploying in another environment.

## Goal and lab topology

The goal is to make Windows Server act as the DHCP server, assign network settings to the Lubuntu machine, and then verify connectivity to Windows Server, the NAT gateway, and the Internet. The final sections explain how DNS is organized with a **forward lookup zone** and a **reverse lookup zone**.

VMware is configured with a **VMnet2** network in **NAT** mode. Disable **Use local DHCP service to distribute IP address to VMs** so VMware does not run a second DHCP server alongside Windows Server.

![VMnet2 uses NAT and VMware local DHCP is disabled](/images/dhcp-va-dns/dhcp-dns-01.png)

The address plan used in this lab is:

| Component | Address / role |
| --- | --- |
| VMnet2 | `192.168.21.0/24` |
| VMware NAT gateway | `192.168.21.2` |
| Windows Server | `192.168.21.3`, static IP |
| Lubuntu | DHCP client, for example `192.168.21.6` |
| Preferred client DNS | `192.168.21.3` |
| Secondary DNS | `8.8.8.8` |

The NAT gateway is supplied by VMware, while Windows Server must use a static IP so clients always know where to send DHCP-related traffic and DNS queries. If VMware local DHCP remains enabled, a client may receive a lease from the wrong DHCP server and the result will be inconsistent.

![Checking the VMnet2 address in VMware](/images/dhcp-va-dns/dhcp-dns-02.png)

![The VMnet2 NAT gateway is 192.168.21.2](/images/dhcp-va-dns/dhcp-dns-03.png)

## Configure a static IP on Windows Server

Open the network adapter's IPv4 properties on Windows Server and set:

- IP address: `192.168.21.3`
- Subnet mask: `255.255.255.0`
- Default gateway: `192.168.21.2`
- Preferred DNS server during the initial Internet check: `8.8.8.8`

![Windows Server uses static IP 192.168.21.3 and gateway 192.168.21.2](/images/dhcp-va-dns/dhcp-dns-04.png)

Verify from Command Prompt:

```text
ipconfig
ping 8.8.8.8
```

The screenshot shows Windows Server with IP `192.168.21.3` and a successful ping to `8.8.8.8`. This separates routing/NAT problems from DHCP problems.

## Install DHCP Server and DNS Server

In **Server Manager**, select **Add Roles and Features**, open **Server Roles**, and check **DHCP Server** and **DNS Server**. Complete the wizard with options appropriate for the lab.

![Select DHCP Server and DNS Server in the Add Roles and Features Wizard](/images/dhcp-va-dns/dhcp-dns-05.png)

After installation, open **Tools > DHCP** in Server Manager.

![Open the DHCP tool from the Tools menu](/images/dhcp-va-dns/dhcp-dns-06.png)

## Create the DHCP scope

In the DHCP console, expand **IPv4**, select **New Scope**, and name it `DHCP - WinServer`.

![Name the scope DHCP - WinServer](/images/dhcp-va-dns/dhcp-dns-07.png)

### Address range and exclusions

Set the address range to `192.168.21.2` through `192.168.21.254`, with a `/24` subnet mask (`255.255.255.0`). Then exclude `192.168.21.2` through `192.168.21.3` so DHCP does not accidentally assign the NAT gateway or Windows Server address.

![Set the range from 192.168.21.2 to 192.168.21.254](/images/dhcp-va-dns/dhcp-dns-08.png)

![Exclude 192.168.21.2 through 192.168.21.3 from the address pool](/images/dhcp-va-dns/dhcp-dns-09.png)

### Scope Options

Configure the important options:

1. **003 Router**: `192.168.21.2`, so clients know the default gateway.
2. **006 DNS Servers**: `192.168.21.3`, then optionally `8.8.8.8` as a secondary DNS server.
3. **004 WINS/NBNS Servers** is only useful when the lab actually has a WINS server; do not add a placeholder address.

![Set 192.168.21.2 as the default gateway in the Router option](/images/dhcp-va-dns/dhcp-dns-10.png)

![Set 192.168.21.3 and 8.8.8.8 as DNS servers](/images/dhcp-va-dns/dhcp-dns-11.png)

![The WINS/NBNS screen in the DHCP scope](/images/dhcp-va-dns/dhcp-dns-12.png)

Option **003 Router** is important because it automatically sends the default gateway to a client whenever the client requests a lease. After activating the scope, a new client on VMnet2 receives an address from the configured range.

![Scope Options showing Router and DNS Servers](/images/dhcp-va-dns/dhcp-dns-13.png)

## Configure and test Lubuntu

Connect the Lubuntu network adapter to the same VMnet2. The connection information shows the client receiving `192.168.21.6/24`, default route `192.168.21.2`, preferred DNS `192.168.21.3`, and secondary DNS `8.8.8.8`.

![Lubuntu receives 192.168.21.6 through DHCP](/images/dhcp-va-dns/dhcp-dns-14.png)

Run the following commands from Lubuntu:

```bash
ip addr
ping 192.168.21.3
ping 192.168.21.2
ping 8.8.8.8
ping google.com
nslookup google.com
nslookup google.com 192.168.21.3
nslookup 192.168.21.3 192.168.21.3
```

Expected checks:

- The client receives a lease from Windows Server and can ping `192.168.21.2`.
- A successful ping to `8.8.8.8` proves that the NAT gateway forwards traffic to the Internet.
- `ping google.com` works when DNS is operating.
- `nslookup google.com 192.168.21.3` sends the query directly to the lab DNS server instead of relying on a local stub resolver.
- `nslookup 192.168.21.3 192.168.21.3` tests the PTR record after the reverse lookup zone is created.

![Lubuntu pings Windows Server before ICMP is allowed](/images/dhcp-va-dns/dhcp-dns-15.png)

During the first test, pings to `192.168.21.3` were lost even though the IP settings were correct. The cause was Windows Firewall blocking inbound ICMP, not an incorrect DHCP lease.

## Allow ICMP in Windows Firewall

Open **Windows Defender Firewall with Advanced Security > Inbound Rules**, find **File and Printer Sharing (Echo Request - ICMPv4-In)**, and choose **Enable Rule** for the profile used by the lab.

![Enable File and Printer Sharing (Echo Request - ICMPv4-In)](/images/dhcp-va-dns/dhcp-dns-16.png)

Run the test again after enabling the rule:

![Lubuntu can ping Windows Server after ICMP is enabled](/images/dhcp-va-dns/dhcp-dns-17.png)

![Lubuntu can ping google.com after DNS is configured](/images/dhcp-va-dns/dhcp-dns-18.png)

The screenshot shows Lubuntu successfully pinging `192.168.21.3`, `192.168.21.2`, and `8.8.8.8`. Windows Server can also ping an Internet hostname.

![Windows Server successfully pings google.com](/images/dhcp-va-dns/dhcp-dns-19.png)

## Forward Lookup Zone

A **forward lookup zone** maps DNS names to IP addresses. Common records include:

- **A**: hostname to IPv4, for example `winserver.lab.test -> 192.168.21.3`.
- **AAAA**: hostname to IPv6.
- **CNAME**: an alias pointing to another hostname.
- **MX**: the mail server for a domain.

In this lab, create a forward zone as follows:

1. Open **Tools > DNS** in Server Manager.
2. Right-click **Forward Lookup Zones > New Zone**.
3. Select **Primary zone**. If Windows Server is also a domain controller, the zone can be stored in Active Directory; an independent lab can use a file-based primary zone.
4. Name the zone `lab.test`.
5. Choose a dynamic update policy appropriate for the environment. For a simple lab, disable dynamic updates and create records manually.
6. Inside `lab.test`, create **New Host (A or AAAA)** with name `winserver` and IP `192.168.21.3`.

![The DNS Server role is installed alongside DHCP Server](/images/dhcp-va-dns/dhcp-dns-05.png)

A query for `winserver.lab.test` now follows the **name -> IP** direction. Microsoft documents A/AAAA records inside forward lookup zones and supports creating zones through DNS Manager or PowerShell ([Manage DNS zones](https://learn.microsoft.com/en-us/windows-server/networking/dns/manage-dns-zones), [Manage DNS resource records](https://learn.microsoft.com/en-us/windows-server/networking/dns/manage-resource-records)).

## Reverse Lookup Zone

A **reverse lookup zone** performs the opposite mapping: an IP address to a hostname using a **PTR** record. For IPv4, Windows DNS uses the special `in-addr.arpa` domain and reverses the network ID octets.

For the `192.168.21.0/24` network, the reverse zone is:

```text
21.168.192.in-addr.arpa
```

Create the zone in DNS Manager:

1. Right-click **Reverse Lookup Zones > New Zone**.
2. Select **Primary zone** and **IPv4 Reverse Lookup Zone**.
3. Enter the **Network ID** `192.168.21`.
4. Create a PTR for host `3` pointing to `winserver.lab.test`. The result is equivalent to `3.21.168.192.in-addr.arpa -> winserver.lab.test`.
5. Test with `nslookup 192.168.21.3 192.168.21.3`.

A reverse zone is not required for ordinary forward DNS resolution, but it helps with logs, host identity checks, and applications that verify a hostname from an IP. Microsoft also notes that reverse lookup/PTR is optional in DNS; not every network needs it ([DNS reverse lookups in Windows Server](https://learn.microsoft.com/en-us/windows-server/networking/dns/reverse-lookup)).

![The Lubuntu client can test DNS after receiving DHCP settings](/images/dhcp-va-dns/dhcp-dns-20.png)

## Quick comparison

| Zone type | Lookup direction | Main records | Example test |
| --- | --- | --- | --- |
| Forward lookup zone | Name -> IP | A, AAAA, CNAME, MX | `nslookup winserver.lab.test 192.168.21.3` |
| Reverse lookup zone | IP -> name | PTR | `nslookup 192.168.21.3 192.168.21.3` |

## Troubleshooting checklist

- If the client receives a gateway other than `192.168.21.2`, check that VMware local DHCP is disabled.
- If Windows Server cannot reach the Internet, verify the static IP, subnet mask, and NAT gateway.
- If the client has an IP but cannot ping the server, check Windows Firewall and the inbound ICMP rule.
- If IP ping works but hostname ping fails, check DHCP option **006**, the DNS service, forwarders, and `nslookup google.com 192.168.21.3`.
- If forward lookup works but reverse lookup fails, check that `21.168.192.in-addr.arpa` and its PTR record exist.

## Conclusion

The lab separates three layers: VMware NAT provides the gateway, Windows Server provides DHCP and DNS, and Lubuntu is the DHCP client. Disabling VMware DHCP, keeping a static server IP, reserving the gateway/server with exclusions, and setting options 003/006 correctly makes the configuration predictable. Forward lookup resolves names to IPs; reverse lookup adds IP-to-name resolution through PTR records.
