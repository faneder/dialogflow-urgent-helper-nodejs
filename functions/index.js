'use strict';

const {
  Permission,
  Confirmation,
  Suggestions,
} = require('actions-on-google');
const {
  responses,
} = require('./responses');

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');
const config = functions.config();

const maps = require('@google/maps');
const googleMapsClient = maps.createClient({
  key: config.maps.key,
  Promise: Promise,
});

const line = require('@line/bot-sdk');
const lineConfig = {
  channelAccessToken: config.line.channel_access_token,
  channelSecret: config.line.channel_secret,
};
const lineClient = new line.Client(lineConfig);

const {
  WebhookClient,
  Card,
  Suggestion,
} = require('dialogflow-fulfillment');

// audio config
const sounds = {
  alarmClock: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'
};

const lineUrgentHelper = {
  imageUrl: 'https://firebasestorage.googleapis.com/v0/b/urgent-helper.appspot.com/o/line%2Fline_qrcode.png?alt=media&token=911314bd-1e90-4426-b967-d4e6092afd3c',
  buttonUrl: 'https://line.me/R/ti/p/%40jcx3672s',
};

/**
 * Ask a user for permission
 * @param {object} agent
 * @param {object} options
 */
const askPermission = (agent, options) => {
  const conv = agent.conv();
  conv.ask(new Permission(options));
  agent.add(conv);
};

/**
 * Call the audio from responses
 * @param {object} agent
 * @param {string} textToSpeech
 */
const askAudio = (agent, textToSpeech) => {
  agent.add(textToSpeech);
};

const linkLine = (agent) => {
  agent.add('Welcome to urgent helper! If you use urgent helper the first time, please set up your contacts with Google Assistant.');
  agent.add(new Card(responses.addLineCard({...lineUrgentHelper})));
  agent.add(new Suggestion('Go forward'));
}

/**
 * Handle intent named 'default welcome intent - next' and 'call_help - next'
 * @param {Object} agent
 */
const setLineSteps = (agent) => {
  agent.add(responses.setLineSteps);
  agent.add(new Suggestion('Store line'));
};

/**
 * Get the closet places from user's coordinates.
 * @param {object} params
 * @return {promise}
 * @return {results<object>}
 */
const getPlacesNearby = async (params) => {
  try {
    const response = await googleMapsClient.placesNearby(params).asPromise()
    const {results, status} = await response.json;

    if (status === 'OK') {
      return results[0];
    }

    throw new Error(`Failed get places for the following reason: ${status}`);
  } catch (error) {
    throw new Error(`Failed Fetch places: ${error}`);
  }
};

/**
 * Get the distance from origin address to destination addresses
 * @param {object} params
 * @return {results<object>}
 */
const getDistanceMatrix = async (params) => {
  try {
    const response = await googleMapsClient.distanceMatrix(params).asPromise();
    const {status, ...results} = await response.json;

    if (status === 'OK') {
      return {...results};
    }

    throw new Error(`Failed get distance for the following reason: ${status}`);
  } catch (error) {
    throw new Error(`Fetch Failed get distance: ${error}`);
  }
};

/**
 * Push message to line
 * @param {string} to
 * @param {array} message
 * @param {array} location
 * @return {results<promise>}
 */

const callContact = async ({to, message, location}) => {
  try {
    const response = await lineClient.pushMessage(to, message);

    if (response) {
      return await lineClient.pushMessage(to, location);
    }
  } catch (error) {
    throw new Error(`line push message Failed: ${error}`);
  }
};

/**
 * Check if has a roomId
 * @param {Object} conv
 * @return {boolean}
 */
const hasRoomId = (conv) => {
  return !!conv.user.storage.roomId;
};

/**
 * Get line room id
 * @param {Object} conv
 * @return {string} roomId
 */
const getRoomId = (conv) => {
  return conv.user.storage.roomId;
};

/**
 * Send notifications to line contacts
 * @param {Object} agent
 */
const sendNotify = async (agent) => {
  const conv = agent.conv();
  const {coordinates} = conv.request.device.location;
  const inOneHour = Math.round((new Date().getTime() + 60 * 60 * 1000) / 1000);

  // find the closet hospital
  const {
    name: hospitalName,
    geometry: geometry,
  } = await getPlacesNearby({
    type: 'hospital',
    location: coordinates,
    rankby: 'distance',
    name: 'hospital',
    opennow: true,
  });

  // get the distance from user's location to the closet hospital
  const {
    rows,
    origin_addresses,
    destination_addresses,
  } = await getDistanceMatrix({
    origins: {
      lat: coordinates.latitude,
      lng: coordinates.longitude,
    },
    destinations: geometry.location,
    departure_time: inOneHour,
    mode: 'driving',
    avoid: ['tolls', 'ferries'],
    traffic_model: 'best_guess',
  });

  const userName = conv.request.user.profile.displayName;
  const emergencyInfo = {
    alarmClock: sounds.alarmClock,
    hospitalName: hospitalName,
    hospitalAddress: destination_addresses[0],
    userName: userName,
    userAddress: origin_addresses[0],
    coordinates: JSON.stringify(coordinates),
    durationTraffic: rows[0].elements[0].duration_in_traffic.text,
  };

  // notify to user's line group
  const contact = await callContact({
    to: getRoomId(conv),
    message: {
      type: 'text',
      text: responses.contactNotify(emergencyInfo)
    },
    location: {
      type: 'location',
      title: `${userName}'s Location`,
      address: origin_addresses[0],
      ...coordinates,
    },
  });

  if (contact) {
    askAudio(agent, responses.emergencyNotify(emergencyInfo));
  }
};

const getGroupChatId = (source) => {
  let id = null;

  switch (source.type) {
    case 'room':
      id = source.roomId;
      break;
    case 'group':
      id = source.groupId;
      break;
  }

  return id;
};

const verifyChatId = (id) => {
  let groupPattern = /C[0-9a-f]{32}/
  let chatPattern = /R[0-9a-f]{32}/

  return (id.match(groupPattern) !== null || id.match(chatPattern) !== null) || false
};

exports.urgentHelper = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({request, response});

  /**
   * Handle intent named 'line_info'
   * @param {Object} agent
   */
  const lineInfo = (agent) => {
    const {source} = request.body.originalDetectIntentRequest.payload.data;
    const chatId = getGroupChatId(source);
    agent.add(`${chatId}`);
  };

  /**
   * Handle intent named 'default welcome intent'
   * @param {Object} agent
   * @return {results}
   */
  const welcome = (agent) => {
    const conv = agent.conv();

    if (hasRoomId(conv)) {
      agent.add('Welcome to urgent helper, how can I help you?');
      return agent.add(new Suggestion('Help'));
    }

    return linkLine(agent);
 };

  /**
   * Handle the intent named 'call_help'
   * @param {object} agent
   */
  const callHelp = (agent) => {
    const conv = agent.conv();

    if (!hasRoomId(conv)) {
      return linkLine(agent);
    }

    const options = {
      context: 'To give results in your area',
      permissions: ['NAME', 'DEVICE_PRECISE_LOCATION'],
    };

    askPermission(agent, options);
  };

  /**
   * Handle the Dialogflow intent named 'actions_intent_PERMISSION'
   * @param {object} agent
   * @return {results}
   */
  const actionsIntentPermission = (agent) => {
    const conv = agent.conv();

    if (!conv.request.user.permissions) {
      throw new Error('Permission not granted');
    }

    return sendNotify(agent);
  };

  /**
   * Handle the intent named 'store_line'
   * @param {object} agent
   */
  const storeLine = async (agent) => {
    const roomId = agent.parameters.room_id[0];

    if (roomId) {
      if (!verifyChatId(roomId)) {
        return agent.add('Your id is invalidate, please check it again.');
      }

      try {
        const response = await lineClient.pushMessage(roomId, {
          type: 'text',
          text: 'Trying to link with google assistant',
        });

        if (response) {
          const conv = agent.conv();
          conv.data.roomId = agent.parameters.room_id[0];
          conv.ask(new Confirmation(`Your room id is: ${roomId}, Can you confirm?`));
          agent.add(conv);
        }
      } catch (error) {
        agent.add('Please check you entered the correct room id from line');
        agent.add(new Suggestion('Store line'));
        console.error(`store line error ${error}`);
      }
    };
  };

  /**
   * Handle the intent named 'store_line - custom'
   * @param {object} agent
   */
  const storeLineConfirmation = (agent) => {
    const conv = agent.conv();
    const roomId = conv.data.roomId;

    if (conv.arguments.get('CONFIRMATION')) {
      conv.user.storage.roomId = roomId;
      conv.ask(`Google assistant has linked your line's room id. You can send your
      urgent information to your contact when you need.`);
      conv.ask(new Suggestions(['Call contact', 'Cancel']));
      agent.add(conv);
    }

    agent.add('You need say yes for using Urgent Helper.');
  };

  /**
   * Handle the intent named 'delete_all_data'
   * @param {object} agent
   */
  const deleteAllData = (agent) => {
    const conv = agent.conv();
    conv.ask(new Confirmation(`Are you sure you want to delete all of the data? Can you confirm?`));
    agent.add(conv);
  };

  /**
   * Handle the intent named 'delete_all_data - confirmation'
   * @param {object} agent
   */
  const deleteAllDataConfirmation = (agent) => {
    const conv = agent.conv();

    if (conv.arguments.get('CONFIRMATION')) {
      conv.user.storage = {};
      conv.close(`We've deleted all of your data in Urgent Helper.`);
      return agent.add(conv);
    }

    agent.add('If you want to delete data, you need say yes for deleting them.');
  };

  let intentMap = new Map();

  switch (agent.requestSource) {
    case 'LINE':
      intentMap.set('line_info', lineInfo);
      break;
    default:
      intentMap.set('store_line', storeLine);
      intentMap.set('store_line - custom', storeLineConfirmation);
      intentMap.set('Default Welcome Intent', welcome);
      intentMap.set('Default Welcome Intent - next', setLineSteps);
      intentMap.set('call_help', callHelp);
      intentMap.set('call_help - next', setLineSteps);
      intentMap.set('actions_intent_PERMISSION', actionsIntentPermission);
      intentMap.set('delete_all_data', deleteAllData);
      intentMap.set('delete_all_data - custom', deleteAllDataConfirmation);
    break;
  }

  agent.handleRequest(intentMap);
});
