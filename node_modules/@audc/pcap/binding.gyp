{
  "targets": [
    {
      "target_name": "pcap_binding",
      "sources": [ "pcap_binding.cc", "pcap_session.cc" ],
      "conditions": [
        ['OS!="win"', {
          "link_settings": {
            "libraries": [
              "-lpcap"
            ]
          }
        }],
      ],
      "include_dirs": [
        "<!(node -e \"require('nan')\")"
      ],
    },
    {
      "target_name": "action_after_build",
      "type": "none",
      "dependencies": [ "pcap_binding" ],
      "copies": [ {
        "files": [ "<(PRODUCT_DIR)/pcap_binding.node" ],
        "destination": "out",
      } ],
    }
  ]
}
