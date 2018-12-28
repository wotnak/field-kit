import logFactory, { SERVER } from './logFactory';

export default {
  actions: {
    // EXPERIMENTAL: GETS AREAS AND OUTPUTS TO CONSOLE
    getAreas() {
      const storage = window.localStorage;
      const storedUrl = storage.getItem('url');
      const storedToken = storage.getItem('token');

      // getRecords requires the params URL, RESOURCE
      // RESOURCE can be 'farm_asset' 'taxonomy_term' 'taxonomy_vocabulary' or 'log'
      getRecords(storedUrl, 'taxonomy_vocabulary') // eslint-disable-line no-use-before-define
        .then().catch(err => console.log('GET ERROR: ', err));
    },

    // EXPERIMENTAL: GETS ASSETS AND OUTPUTS TO CONSOLE
    getAssets() {
      const storage = window.localStorage;
      const storedUrl = storage.getItem('url');
      const storedToken = storage.getItem('token');
      getRecords(storedUrl, 'farm_asset') // eslint-disable-line no-use-before-define
        .then().catch(err => console.log('GET ERROR: ', err));
    },

    // SEND RECORDS TO SERVER
    pushToServer({ commit, rootState }, payload) {
      const storage = window.localStorage;
      const storedUrl = storage.getItem('url');
      const storedToken = storage.getItem('token');

      function handleSyncResponse(response, index) {
        commit('updateLogs', {
          indices: [index],
          mapper(log) {
            return logFactory({
              ...log,
              id: response.id,
              wasPushedToServer: true,
              remoteUri: response.uri,
            });
          },
        });
      }

      function handleSyncError(error, index) {
        // Do something with a TypeError object (mostly likely no connection)
        if (typeof error === 'object' && error.status === undefined) {
          const errorPayload = {
            message: `Unable to sync "${rootState.farm.logs[index].name}" because the network is currently unavailable. Please try syncing again later.`,
            errorCode: error.statusText,
            level: 'warning',
            show: true,
          };
          commit('logError', errorPayload);
        } else if (error.status === 401 || error.status === 403) {
          // Reroute authentication or authorization errors to login page
          payload.router.push('/login');
        } else {
          // handle some other type of runtime error (if possible)
          const errorPayload = {
            message: `${error.status} error while syncing "${rootState.farm.logs[index].name}": ${error.statusText}`,
            errorCode: error.statusText,
            level: 'warning',
            show: true,
          };
          commit('logError', errorPayload);
        }
        commit('updateLogs', {
          indices: [index],
          mapper(log) {
            return logFactory({
              ...log,
              isReadyToSync: false,
            });
          },
        });
      }

      // Send records to the server, unless the user isn't logged in
      if (storedToken) {
        payload.indices.map(index => (
          pushRecord(storedUrl, storedToken, rootState.farm.logs[index]) // eslint-disable-line no-use-before-define, max-len
            .then(res => handleSyncResponse(res, index))
            .catch(err => handleSyncError(err, index))
        ));
      } else {
        payload.router.push('/login');
      }
    },

  },
};


// Executes AJAX to send records to server
function pushRecord(url, token, log) {
  const loc = '/log';
  const logUrl = url + loc;
  const formattedLog = logFactory(log, SERVER);
  const requestHeaders = {
    'X-CSRF-Token': token,
    'Content-Type': 'application/json',
    Accept: 'json',
  };
  console.log(`PUSHING REQUEST URL : ${logUrl}`);
  console.log('RECORDS SENDING: ', JSON.stringify(formattedLog));
  return new Promise((resolve, reject) => {
    fetch(logUrl, {
      method: 'POST',
      headers: requestHeaders,
      credentials: 'include',
      body: JSON.stringify(formattedLog),
    }).then((response) => {
      console.log('fetch response: ', response);
      if (!response.ok) {
        throw response;
      }
      return response.json();
    }).then(resolve).catch(reject);
  });
}

// EXPERIMENTAL
// Executes AJAX to get records from server
function getRecords(farmosUrl, recordClass) {
  const logUrl = `${farmosUrl}/${recordClass}.json`;
  const requestHeaders = {
    'Content-Type': 'application/json',
  };
  console.log(`GETTING RECORDS FROM URL : ${logUrl}`);
  return new Promise((resolve, reject) => {
    fetch(logUrl, {
      method: 'GET',
      mode: 'cors',
      headers: requestHeaders,
      credentials: 'include',
    }).then((response) => {
      console.log('RESPONSE TO GET REQUEST RECEIVED!');
      if (!response.ok) {
        throw response;
      }
      return response.json();
    }).then((response) => {
      if (recordClass === 'taxonomy_vocabulary') {
        console.log('DISPLAYING THE VID FOR AREA TERMS');
        // Extracts single numerical value from the returned array
        const areaVid = response.list.find(e => e.machine_name === 'farm_areas').vid;
        console.log(areaVid);
      } else {
        // When making a call to log or taxonomy_term I will display all values received
        console.log('DISPLAYING REQUESTED VALUES');
        console.log(response);
      }
    }).catch(reject);
  });
}
