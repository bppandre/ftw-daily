const http = require('http');
const https = require('https');
const sharetribeSdk = require('sharetribe-flex-sdk');
const sdkUtils = require('../../api-util/sdk');

const CLIENT_ID = process.env.REACT_APP_SHARETRIBE_SDK_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_SDK_CLIENT_SECRET;
const TRANSIT_VERBOSE = process.env.REACT_APP_SHARETRIBE_SDK_TRANSIT_VERBOSE === 'true';
const USING_SSL = process.env.REACT_APP_SHARETRIBE_USING_SSL === 'true';
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;
const rootUrl = process.env.REACT_APP_CANONICAL_ROOT_URL;

// Instantiate HTTP(S) Agents with keepAlive set to true.
// This will reduce the request time for consecutive requests by
// reusing the existing TCP connection, thus eliminating the time used
// for setting up new TCP connections.
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const baseUrl = BASE_URL ? { baseUrl: BASE_URL } : {};

module.exports = (err, user, req, res, clientID, source) => {
  if (err) {
    console.error(err);
    res
      .cookie(
        'autherror',
        {
          status: err.status,
          code: err.code,
          message: err.message,
        },
        {
          maxAge: 15 * 60 * 1000, // 15 minutes
        }
      )
      .redirect(`${rootUrl}/login#`);
  }

  const tokenStore = sharetribeSdk.tokenStore.expressCookieStore({
    clientId: CLIENT_ID,
    req,
    res,
    secure: USING_SSL,
  });

  const sdk = sharetribeSdk.createInstance({
    transitVerbose: TRANSIT_VERBOSE,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    httpAgent,
    httpsAgent,
    tokenStore,
    typeHandlers: sdkUtils.typeHandlers,
    ...baseUrl,
  });

  sdk
    .authWithIdp({
      idpClientId: `${clientID}`,
      idpToken: `${user ? user.accessToken : null}`,
    })
    .then(response => {
      if (response.status === 200) {
        res.redirect(`${rootUrl}/#`);
      }
    })
    .catch(() => {
      // If authentication fails, we want to create a new user with idp
      // For this we will need to pass some information to frontend so
      // that we can use that in createWithIdp api call.
      // The createWithIdp api call is triggered from frontend
      // after showing a confirm page to user

      res.cookie(
        'authinfo',
        {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          idpToken: `${user.accessToken}`,
          source,
        },
        {
          maxAge: 15 * 60 * 1000, // 15 minutes
        }
      );

      res.redirect(`${rootUrl}/confirm#`);
    });
};
