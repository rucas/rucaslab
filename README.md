# rucaslab

Homelab service index and golinks — a NixOS module that serves a searchable link directory at `rucaslab.com` and handles `go/<name>` redirects via Caddy.

## Structure

```
site/               Zola project (templates, CSS, JS)
nixos/default.nix   NixOS module (Caddy + AdGuard wiring)
nixos/site.nix      Nix build: injects golinks into Zola config and runs zola build
flake.nix           Flake outputs: preview package, serve app, NixOS module
```

## Development

```bash
nix develop         # enter shell with zola available
cd site
zola serve          # hot-reload dev server at http://localhost:1111
```

The `site/config.toml` contains placeholder golinks for local development. The Nix build always overwrites it with the real config from `services.rucaslab.golinks`.

## Preview

```bash
nix build .#packages.aarch64-darwin.preview
nix run .#serve     # serves built site at http://localhost:8080
```

## NixOS module

```nix
{
  imports = [ rucaslab.nixosModules.default ];

  services.rucaslab = {
    enable = true;
    serverIP = "192.168.1.50";
    golinks = {
      docs    = "https://docs.example.com";
      grafana = "https://grafana.example.com";
      home    = "https://home.example.com";
    };
  };
}
```

Requires `services.caddy` and `services.adguardhome` to be configured on the host.
