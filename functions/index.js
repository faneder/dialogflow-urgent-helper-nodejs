'use strict';

const {
  Permission,
  Confirmation,
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
} = require('dialogflow-fulfillment');

// audio config
const sounds = {
  alarmClock: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'
};

/**
 * ask a user for permission
 * @param {object} options
 */
const askPermission = (agent, options) => {
  let conv = agent.conv();
  conv.ask(new Permission(options));
  agent.add(conv);
};

/**
 * call the audio from responses
 * @param {string} textToSpeech
 */
const askAudio = (agent, textToSpeech) => {
  agent.add(textToSpeech);
};

/**
 * Gets the closet places from user's coordinates.
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
 * Gets the distance from origin address to destination addresses
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
 * push message to line
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

const hasRoomId = (conv) => {
  return !!conv.user.storage.roomId;
};

const getRoomId = (conv) => {
  return conv.user.storage.roomId;
};

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

exports.urgentHelper = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({request, response});

  const lineInfo = (agent) => {
    agent.add(`Please copy below's room id to your google assistant`);
    const id = request.body.originalDetectIntentRequest.payload.data.source.roomId;
    agent.add(`${id}`);
  };

  const welcome = (agent) => {
    const conv = agent.conv();

    if (hasRoomId(conv)) {
      const options = {
        context: 'To give results in your area',
        permissions: ['NAME', 'DEVICE_PRECISE_LOCATION'],
      };
      askPermission(agent, options);
    } else {
      agent.add(`following below's steps for setting up your chat room with google assistant`);
      agent.add(`1. go to LINE App and call "get room id" to get your room id`);
      agent.add(`2. call "store line" at google assistant and enter your room id`);
    }
  };

  /**
   * Handle the Dialogflow intent named 'actions_intent_PERMISSION
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

  const storeLine = async (agent) => {
    const conv = agent.conv();
    const roomId = agent.parameters.room_id[0];

    if (roomId) {
      try {
        const response = await lineClient.pushMessage(roomId, {
          type: 'text',
          text: 'success link to google assistant',
        });

        if (response) {
          conv.user.storage.roomId = roomId;
          conv.ask(new Confirmation(`Your room id is: ${roomId}, Can you confirm?`));
        }
      } catch (error) {
        conv.close(`Please check you entered the room id from line correctly`);
        console.error(`store line error ${error}`);
      }

      agent.add(conv);
    };
  };

  let intentMap = new Map();

  switch (agent.requestSource) {
    case 'LINE':
      intentMap.set('line_info', lineInfo);
      break;
    default:
      intentMap.set('Default Welcome Intent', welcome);
      intentMap.set('actions_intent_PERMISSION', actionsIntentPermission);
      intentMap.set('store_line', storeLine);
      break;
  }

  agent.handleRequest(intentMap);
});
