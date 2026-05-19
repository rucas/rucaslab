{ pkgs, lib }:
golinks:
let
  golinksToml = lib.concatStringsSep "" (lib.mapAttrsToList
    (name: url:
      "\n[[extra.golinks]]\n" +
      "name        = \"${name}\"\n" +
      "url         = \"${url}\"\n"
    )
    golinks);

  configToml = pkgs.writeText "config.toml" ''
    base_url = "/"
    compile_sass = false
    generate_feeds = false
    ${golinksToml}
  '';
in
pkgs.runCommand "rucaslab-site"
{
  nativeBuildInputs = [ pkgs.zola ];
} ''
  cp -r ${../site} site
  chmod -R u+w site
  cp ${configToml} site/config.toml
  cd site && zola build --output-dir $out
''
