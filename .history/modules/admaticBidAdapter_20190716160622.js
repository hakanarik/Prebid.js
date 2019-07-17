import * as utils from '../src/utils';
import { registerBidder } from '../src/adapters/bidderFactory';
import { BANNER, NATIVE, VIDEO, ADPOD } from '../src/mediaTypes';
import includes from 'core-js/library/fn/array/includes';

const BIDDER_CODE = 'admatic';
const ENDPOINT_URL = '//ads4.admatic.com.tr/prebid/v3/bidrequest';
const SOURCE = 'pbjs';

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER, VIDEO, NATIVE],
  /**
  * Determines whether or not the given bid request is valid.
  *
  * @param {BidRequest} bid The bid params to validate.
  * @return boolean True if this is a valid bid, and false otherwise.
  */
  isBidRequestValid: function (bid) {
    return !!(bid.params.pid && bid.params.wid);
  },
  /**
  * Make a server request from the list of BidRequests.
  *
  * @param {validBidRequests[]} - an array of bids
  * @return ServerRequest Info describing the request to the server.
  */
  buildRequests: function (validBidRequests, bidderRequest) {
    const payload = {
      request: [],
      sdk: {
        source: SOURCE,
        version: '$prebid.version$'
      }
    };

    for (var i = 0; i < validBidRequests.length; i++) {
      var validBidRequest = validBidRequests[i];
      payload.auctionId = validBidRequest.auctionId;
      payload.bidder = validBidRequest.bidder;
      payload.bidderRequestId = validBidRequest.bidderRequestId;
      payload.pid = validBidRequest.params.pid;
      payload.wid = validBidRequest.params.wid;
      payload.url = bidderRequest.refererInfo.referer;
      console.log(bidderRequest);
      if (typeof (validBidRequest.params.nocount) != 'undefined') { payload.nocount = validBidRequest.params.nocount; }
      payload.screen = {
        width: screen.width,
        height: screen.height
      };

      // Check gdprConsent
      if (bidderRequest && bidderRequest.gdprConsent) {
        // note - objects for impbus use underscore instead of camelCase
        payload.gdpr_consent = {
          consent_string: bidderRequest.gdprConsent.consentString,
          consent_required: bidderRequest.gdprConsent.gdprApplies
        };
      }

      // Add Referer Info
      if (bidderRequest && bidderRequest.refererInfo) {
        let refererinfo = {
          rd_ref: encodeURIComponent(bidderRequest.refererInfo.referer),
          rd_top: bidderRequest.refererInfo.reachedTop,
          rd_ifs: bidderRequest.refererInfo.numIframes,
          rd_stk: bidderRequest.refererInfo.stack.map((url) => encodeURIComponent(url)).join(',')
        }
        payload.referrer_detection = refererinfo;
      }

      let tagsizes = transformSizes(validBidRequest.sizes);
      var request = {
        adUnitCode: validBidRequest.adUnitCode,
        bidId: validBidRequest.bidId,
        transactionId: validBidRequest.transactionId,
        primary_size: tagsizes[0],
        sizes: tagsizes,
        ad_types: []
      }

      if (typeof (validBidRequest.params.bidfloor) != 'undefined' && validBidRequest.params.bidfloor) {
        request.bidfloor = validBidRequest.params.bidfloor;
      }

      // Add ad_types to request
      // Video
      const videoMediaType = utils.deepAccess(validBidRequest, `mediaTypes.${VIDEO}`);
      const context = utils.deepAccess(validBidRequest, 'mediaTypes.video.context');

      if (validBidRequest.mediaType === VIDEO || videoMediaType) {
        request.ad_types.push(VIDEO);
      }

      // instream gets vastUrl, outstream gets vastXml
      if (validBidRequest.mediaType === VIDEO || (videoMediaType && context !== 'outstream')) {
        request.require_asset_url = true;
      }

      if (validBidRequest.params.video) {
        request.video = {};
        // place any valid video params on the tag
        Object.keys(validBidRequest.params.video)
          .filter(param => includes(VIDEO_TARGETING, param))
          .forEach(param => request.video[param] = validBidRequest.params.video[param]);
      }

      // NATIVE
      if (validBidRequest.mediaType === NATIVE || utils.deepAccess(validBidRequest, `mediaTypes.${NATIVE}`)) {
        request.ad_types.push(NATIVE);
        if (request.sizes.length === 0) {
          request.sizes = transformSizes([1, 1]);
        }

        if (validBidRequest.nativeParams) {
          const nativeRequest = buildNativeRequest(validBidRequest.nativeParams);
          request[NATIVE] = {layouts: [nativeRequest]};
        }
      }

      // Banner
      if (
        (utils.isEmpty(validBidRequest.mediaType) && utils.isEmpty(validBidRequest.mediaTypes)) ||
        (validBidRequest.mediaType === BANNER || (validBidRequest.mediaTypes && validBidRequest.mediaTypes[BANNER]))
      ) {
        request.ad_types.push(BANNER);
      }

      payload.request.push(request);
    }

    const payloadString = JSON.stringify(payload);

    return {
      method: 'POST',
      url: ENDPOINT_URL,
      data: payloadString,
      bidder: 'admatic',
      bids: validBidRequests
    };
  },

  /**
  * Unpack the response from the server into a list of bids.
  *
  * @param {ServerResponse} serverResponse A successful response from the server.
  * @return {Bid[]} An array of bids which were nested inside the server.
  */
  interpretResponse: function (serverResponse, {bidderRequest}) {
    const serverBody = serverResponse.body;
    const bidResponses = [];

    // if serverResponse Error
    if (!serverResponse || serverResponse.error) {
      let errorMessage = `in response for ${bidderRequest.bidderCode} adapter`;
      if (serverResponse && serverResponse.error) { errorMessage += `: ${serverResponse.error}`; }
      utils.logError(errorMessage);
      return bids;
    }

    if (serverBody) {
      if (serverBody.tags && serverBody.tags.length > 0) {
        serverBody.tags.forEach(serverBid => {
          const rtbBid = getRtbBid(serverBid);
          if (rtbBid) {
            if (rtbBid.cpm !== 0 && includes(this.supportedMediaTypes, rtbBid.ad_type)) {
              const bid = newBid(serverBid, rtbBid, bidderRequest);
              bid.mediaType = parseMediaType(rtbBid);
              bidResponses.push(bid);
            }
          }
          // if (serverBid != null) {
          //   if (serverBid.cpm !== 0) {
          //     // const bidResponse = {
          //     //   requestId: serverBid.bidId,
          //     //   cpm: serverBid.cpm,
          //     //   width: serverBid.width,
          //     //   height: serverBid.height,
          //     //   creativeId: serverBid.creativeId,
          //     //   dealId: serverBid.dealId,
          //     //   currency: serverBid.currency,
          //     //   netRevenue: serverBid.netRevenue,
          //     //   ttl: serverBid.ttl,
          //     //   referrer: serverBid.referrer,
          //     //   ad: serverBid.ad
          //     // };

          //     bidResponses.push(bidResponse);
          //   }
          // }
        });
      }
    }

    return bidResponses;
  },
  /**
  * Register the user sync pixels which should be dropped after the auction.
  *
  * @param {SyncOptions} syncOptions Which user syncs are allowed?
  * @param {ServerResponse[]} serverResponses List of server's responses.
  * @return {UserSync[]} The user syncs which should be dropped.
  */
  getUserSyncs: function (syncOptions, serverResponses) {
    const syncs = [];
    if (syncOptions.iframeEnabled) {
      syncs.push({
        type: 'iframe',
        url: '//ads4.admatic.com.tr/prebid/static/usersync/v3/async_usersync.html'
      });
    }

    if (syncOptions.pixelEnabled && serverResponses.length > 0) {
      syncs.push({
        type: 'image',
        url: 'https://ads5.admatic.com.tr/prebid/v3/bidrequest/usersync'
      });
    }
    return syncs;
  }
}

/* Turn bid request sizes into ut-compatible format */
function transformSizes(requestSizes) {
  let sizes = [];
  let sizeObj = {};

  if (utils.isArray(requestSizes) && requestSizes.length === 2 &&
    !utils.isArray(requestSizes[0])) {
    sizeObj.width = parseInt(requestSizes[0], 10);
    sizeObj.height = parseInt(requestSizes[1], 10);
    sizes.push(sizeObj);
  } else if (typeof requestSizes === 'object') {
    for (let i = 0; i < requestSizes.length; i++) {
      let size = requestSizes[i];
      sizeObj = {};
      sizeObj.width = parseInt(size[0], 10);
      sizeObj.height = parseInt(size[1], 10);
      sizes.push(sizeObj);
    }
  }

  return sizes;
}

function getRtbBid(tag) {
  return tag && tag.ads && tag.ads.length && find(tag.ads, ad => ad.rtb);
}

/**
 * Unpack the Server's Bid into a Prebid-compatible one.
 * @param serverBid
 * @param rtbBid
 * @param bidderRequest
 * @return Bid
 */
function newBid(serverBid, rtbBid, bidderRequest) {
  const bidRequest = utils.getBidRequest(serverBid.uuid, [bidderRequest]);
  const bid = {
    requestId: serverBid.uuid,
    cpm: rtbBid.cpm,
    creativeId: rtbBid.creative_id,
    dealId: rtbBid.deal_id,
    currency: rtbBid.currency,
    netRevenue: true,
    ttl: 300,
    adUnitCode: bidRequest.adUnitCode
  };

  if (rtbBid.rtb.video) {
    Object.assign(bid, {
      width: rtbBid.rtb.video.player_width,
      height: rtbBid.rtb.video.player_height,
      vastUrl: rtbBid.rtb.video.asset_url,
      vastImpUrl: rtbBid.notify_url,
      ttl: 3600
    });

    const videoContext = utils.deepAccess(bidRequest, 'mediaTypes.video.context');
    if (videoContext === ADPOD) {
      const iabSubCatId = getIabSubCategory(bidRequest.bidder, rtbBid.brand_category_id);
      bid.meta = {
        iabSubCatId
      };

      bid.video = {
        context: ADPOD,
        durationSeconds: Math.floor(rtbBid.rtb.video.duration_ms / 1000),
      };
    }

    // This supports Outstream Video
    if (rtbBid.renderer_url) {
      const rendererOptions = utils.deepAccess(
        bidderRequest.bids[0],
        'renderer.options'
      );

      Object.assign(bid, {
        adResponse: serverBid,
        renderer: newRenderer(bid.adUnitCode, rtbBid, rendererOptions)
      });
      bid.adResponse.ad = bid.adResponse.ads[0];
      bid.adResponse.ad.video = bid.adResponse.ad.rtb.video;
    }
  } else if (rtbBid.rtb[NATIVE]) {
    const nativeAd = rtbBid.rtb[NATIVE];
    bid[NATIVE] = {
      title: nativeAd.title,
      body: nativeAd.desc,
      body2: nativeAd.desc2,
      cta: nativeAd.ctatext,
      rating: nativeAd.rating,
      sponsoredBy: nativeAd.sponsored,
      privacyLink: nativeAd.privacy_link,
      address: nativeAd.address,
      downloads: nativeAd.downloads,
      likes: nativeAd.likes,
      phone: nativeAd.phone,
      price: nativeAd.price,
      salePrice: nativeAd.saleprice,
      clickUrl: nativeAd.link.url,
      displayUrl: nativeAd.displayurl,
      clickTrackers: nativeAd.link.click_trackers,
      impressionTrackers: nativeAd.impression_trackers,
      javascriptTrackers: nativeAd.javascript_trackers
    };
    if (nativeAd.main_img) {
      bid['native'].image = {
        url: nativeAd.main_img.url,
        height: nativeAd.main_img.height,
        width: nativeAd.main_img.width,
      };
    }
    if (nativeAd.icon) {
      bid['native'].icon = {
        url: nativeAd.icon.url,
        height: nativeAd.icon.height,
        width: nativeAd.icon.width,
      };
    }
  } else {
    Object.assign(bid, {
      width: rtbBid.rtb.banner.width,
      height: rtbBid.rtb.banner.height,
      ad: rtbBid.rtb.banner.content
    });
    try {
      const url = rtbBid.rtb.trackers[0].impression_urls[0];
      const tracker = utils.createTrackPixelHtml(url);
      bid.ad += tracker;
    } catch (error) {
      utils.logError('Error appending tracking pixel', error);
    }
  }

  return bid;
}

registerBidder(spec);
