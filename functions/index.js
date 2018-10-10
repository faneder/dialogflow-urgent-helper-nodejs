'use strict';

const {
    dialogflow,
    Permission,
} = require('actions-on-google');
const { responses } = require('./responses');

// Instantiate the Dialogflow Client.
const app = dialogflow({ debug: true });

// Import the firebase-functions package for deployment.
const functions = require('firebase-functions');
const config = functions.config();

const maps = require('@google/maps');
const googleMapsClient = maps.createClient({
    key: config.maps.key,
    Promise: Promise
});

// audio config
const sounds = {
    alarmClock: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg'
}

/**
 * ask a user for permission
 * @param {object} options
 */
const askPermission = (conv, options) => {
    conv.ask(new Permission(options));
}

/**
 * call the audio from responses
 * @param {string} text_to_speech
 */
const askAudio = (conv, text_to_speech) => {
    conv.ask(text_to_speech)
}

/**
 * Gets the closet places from user's coordinates.
 * @param {object} location {latitude, longitude}
 * @param {string} name
 * @param {string} hospital
 * @param {string} language
 * @param {string} rankby
 * @return {promise}
 * @return {results<object>}
 */
const getPlacesNearby = async (params) => {
    const { results, status } = await googleMapsClient.placesNearby(params).asPromise()
    .then((response) => {
        return response.json;
    })
    .catch((err) => {
        throw new Error(`placesNearby Fetch Failed: ${err}`);
    });

    if (status === 'OK') {
        return results[0];
    }

    throw new Error(`getPlacesNearby Failed for the following reason: ${status}`);
}

/**
 * Gets the distance from origin address to destination addresses
 * @param {object} location {latitude, longitude}
 * @param {string} destinations
 * @param {number} departure_time
 * @param {string} mode
 * @param {array} avoid
 * @param {string} traffic_model
 * @return {results<object>}
 */

const getDistanceMatrix = async (params) => {
    const {
        rows,
        status,
        origin_addresses,
        destination_addresses
    } = await googleMapsClient.distanceMatrix(params).asPromise()
    .then((response) => {
        return response.json;
    })
    .catch((err) => {
        throw new Error(`getDistanceMatrix Fetch Failed: ${err}`);
    });

    if (status === 'OK') {
        return { rows, origin_addresses, destination_addresses };
    }

    throw new Error(`distanceMatrix Failed for the following reason: ${status}`);
}

/**
 * Handle the Dialogflow intent named 'Default Welcome Intent'.
 */
app.intent('Default Welcome Intent', (conv) => {
    const options = {
        context: 'In according to help you find the closet hospital in the best way.',
        // Ask for more than one permission. User can authorize all or none.
        permissions: ['NAME', 'DEVICE_PRECISE_LOCATION'],
    };
    askPermission(conv, options)
});

/**
 * Handle the Dialogflow intent named 'actions_intent_PERMISSION
 * @param {boolean} permissionGranted
 */
// app.intent('actions_intent_PERMISSION', (conv, params, permissionGranted) => {
app.intent('actions_intent_PERMISSION', async (conv, params, permissionGranted) => {
    if (!permissionGranted) {
        throw new Error('Permission not granted');
    }

    const { coordinates } = conv.device.location;
    const inOneHour = Math.round((new Date().getTime() + 60 * 60 * 1000) / 1000);

    // find the close place
    const {
        name: hospitalName,
        geometry: geometry
     } = await getPlacesNearby({
        type: 'hospital',
        location: coordinates,
        rankby: 'distance',
        name: 'hospital',
        opennow: true
    }).catch((err) => {
        throw new Error(err);
    });

    const {
        rows,
        origin_addresses,
        destination_addresses,
    } = await getDistanceMatrix({
        origins: { lat: coordinates.latitude, lng: coordinates.longitude },
        destinations: geometry.location,
        departure_time: inOneHour,
        mode: 'driving',
        avoid: ['tolls', 'ferries'],
        traffic_model: 'best_guess'
    }).catch((err) => {
        throw new Error(err);
    });

    const emergencyInfo = {
        alarmClock: sounds.alarmClock,
        hospitalName: hospitalName,
        hospitalAddress: destination_addresses[0],
        userName: conv.user.name.display,
        userAddress: origin_addresses[0],
        coordinates: JSON.stringify(coordinates),
        durationTraffic: rows[0].elements[0].duration_in_traffic.text
    }

    askAudio(conv, responses.emergencyNotify(emergencyInfo));
});

/**
 * Handle the incoming error
 */
app.catch((conv, e) => {
    conv.close(responses.errorNotify);
    console.error(e);
});

exports.urgentHelper = functions.https.onRequest(app);

