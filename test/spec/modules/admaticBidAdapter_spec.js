import {assert, expect} from 'chai';
import * as url from 'src/url';
import {spec} from 'modules/admaticBidAdapter';
import { BANNER } from 'src/mediaTypes';

describe('AdMatic adapter', () => {
  let serverResponse, bidRequest, bidResponses;
  let bids = [];

  describe('isBidRequestValid', () => {
    let bid = {
      'bidder': 'admatic',
      'params': {
        'pid': '193937152158',
        'wid': '104276324971',
        'priceType': 'gross',
        'url': 'window.location.href || window.top.location.href'
      }
    };

    it('should return true when required params found', () => {
      assert(spec.isBidRequestValid(bid));
    });
  });

  describe('buildRequests', () => {
    it('should pass multiple bids via single request', () => {
      let request = spec.buildRequests(bids);
    });
  });
});
