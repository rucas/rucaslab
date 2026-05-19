{ config
, lib
, pkgs
, ...
}:
let
  cfg = config.services.rucaslab;
  buildSite = import ./site.nix { inherit pkgs lib; };
  sitePackage = buildSite cfg.golinks;
in
{
  options.services.rucaslab = {
    enable = lib.mkEnableOption "rucaslab golinks and index page";

    serverIP = lib.mkOption {
      type = lib.types.str;
      description = "LAN IP for AdGuard DNS rewrite of the 'go' hostname.";
      example = "192.168.1.50";
    };

    golinks = lib.mkOption {
      type = lib.types.listOf (
        lib.types.submodule {
          options = {
            name = lib.mkOption {
              type = lib.types.str;
              description = "Short name used in go/<name> URLs.";
            };
            url = lib.mkOption {
              type = lib.types.str;
              description = "Destination URL.";
            };
            description = lib.mkOption {
              type = lib.types.str;
              default = "";
              description = "Human-readable description shown on the index card.";
            };
          };
        }
      );
      default = [ ];
      example = [
        {
          name = "docs";
          url = "https://docs.rucaslab.com";
          description = "Project docs";
        }
      ];
      description = "List of golinks — drives go/<name> redirects and the index page.";
    };
  };

  config = lib.mkIf cfg.enable {
    services.caddy.virtualHosts."rucaslab.com" = {
      extraConfig = ''
        handle /prometheus/* {
          uri strip_prefix /prometheus
          reverse_proxy http://localhost:9001
        }
        handle /loki/* {
          uri strip_prefix /loki
          reverse_proxy http://localhost:3030
        }
        handle {
          root * ${sitePackage}
          file_server
        }
      '';
    };

    services.caddy.virtualHosts."http://go" = {
      extraConfig = ''
        log {
          output stderr
          format json
        }
        ${lib.concatMapStrings (link: ''
          @${link.name} path /${link.name}
          redir @${link.name} ${link.url} 301
        '') cfg.golinks}
        root * ${sitePackage}
        file_server
      '';
    };

    services.adguardhome.settings.filtering.rewrites = [
      {
        domain = "go";
        answer = cfg.serverIP;
      }
    ];
  };
}
