# Overview

```
Module Name: AdMatic Bidder Adapter
Module Type: Bidder Adapter
Maintainer: prebid@admatic.com.tr
```

# Description

Module that connects to AdMatic demand sources

# Test Parameters
```
    var adUnits = [
        {
            code: 'test-div',
            mediaTypes: {
                banner: {
                    sizes: [[300, 250]],  // a display size
                }
            },
            bids: [
               {
                   bidder: "admatic",
                   params: {
                        pid: 193937152158, // publisher id without "adm-pub-" prefix 
                        wid: 104276324971  // website id
                    }
               }
           ]
        },{
            code: 'test-div',
            mediaTypes: {
                banner: {
                    sizes: [[320, 50]],   // a mobile size
                }
            },
            bids: [
               {
                   bidder: "admatic",
                   params: {
                        pid: 193937152158, // publisher id without "adm-pub-" prefix 
                        wid: 104276324971 // website id
                    }
               }
           ]
        }
    ];
```
