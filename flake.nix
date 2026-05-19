{
  description = "rucaslab homelab NixOS module — golinks + service index";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    pre-commit-hooks = {
      url = "github:cachix/pre-commit-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.pre-commit-hooks.flakeModule ];

      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      perSystem =
        {
          config,
          pkgs,
          lib,
          ...
        }:
        {
          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              git
              nixfmt
              zola
            ];
            shellHook = ''
              ${config.pre-commit.installationScript}
            '';
          };

          formatter = pkgs.nixfmt;

          pre-commit.settings = {
            src = ./.;
            hooks.nixfmt.enable = true;
          };

          packages.preview =
            let
              buildSite = import ./nixos/site.nix { inherit pkgs lib; };
            in
            buildSite [
              {
                name = "docs";
                url = "https://docs.rucaslab.com";
                description = "Project documentation";
              }
              {
                name = "home";
                url = "https://home.rucaslab.com";
                description = "Home dashboard";
              }
              {
                name = "grafana";
                url = "https://grafana.rucaslab.com";
                description = "Metrics and dashboards";
              }
              {
                name = "budget";
                url = "https://budget.rucaslab.com";
                description = "Budget tracker";
              }
              {
                name = "wiki";
                url = "https://wiki.rucaslab.com";
                description = "Internal wiki";
              }
              {
                name = "status";
                url = "https://status.rucaslab.com";
                description = "Uptime Kuma status page";
              }
            ];

          apps.serve = {
            type = "app";
            program = lib.getExe (
              pkgs.writeShellScriptBin "serve" ''
                echo "Serving at http://localhost:8080"
                ${pkgs.python3}/bin/python3 -m http.server 8080 \
                  --directory ${config.packages.preview}
              ''
            );
          };
        };

      flake = {
        nixosModules.default = import ./nixos/default.nix;
      };
    };
}
