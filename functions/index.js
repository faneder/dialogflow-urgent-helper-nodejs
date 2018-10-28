'use strict';

const {
    dialogflow,
    Permission,
} = require('actions-on-google');
const {responses} = require('./responses');

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

const {WebhookClient} = require('dialogflow-fulfillment');

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

        throw new Error(`getPlacesNearby Failed for the following reason: ${status}`);
    } catch (error) {
        throw new Error(`placesNearby Fetch Failed: ${error}`);
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

        throw new Error(`distanceMatrix Failed for the following reason: ${status}`);
    } catch (error) {
        throw new Error(`getDistanceMatrix Fetch Failed: ${error}`);
    }
};

/**
 * push message to line
 * @param {string} to
 * @param {array} message
 * @param {array} location
 * @return {results<promise>}
 */

const callContact = async ({ to, message, location }) => {
    const response = await lineClient.pushMessage(to, message).catch((err) => {
        throw new Error(`line push message Failed: ${err}`);
    });
    if (response) {
        return await lineClient.pushMessage(to, location);
    }
};

exports.urgentHelper = functions.https.onRequest((request, response) => {
    console.log(request)
    const agent = new WebhookClient({request, response});

    const line = (agent) => {
        console.log('lineagent')
        console.log(agent)
        agent.add(`Please copy below's id to your google assitant`);
        let id = request.body.originalDetectIntentRequest.payload.data.source.roomId;
        agent.add(`Your room id is: ${id}`);
    };

    const welcome = (agent) => {
        agent.add(`Welcome to my agent!`);

        const options = {
            context: 'To give results in your area',
            permissions: ['NAME', 'DEVICE_PRECISE_LOCATION'],
        };
        askPermission(agent, options)
    };

    /**
     * Handle the Dialogflow intent named 'actions_intent_PERMISSION
     * @param {boolean} permissionGranted
     */
    // const permission = (conv, params, permissionGranted) => {
    const actionsIntentPermission = async (agent, params, permissionGranted) => {
        let conv = agent.conv();
        const data = conv.request;
        if (!conv.request.user.permissions) {
            throw new Error('Permission not granted');
        }
        console.log(JSON.stringify(conv, null, 4));
        console.log(JSON.stringify(data, null, 4));
        console.log(JSON.stringify(data.user.profile.displayName, null, 4));


        const { coordinates } = data.device.location;
        const inOneHour = Math.round((new Date().getTime() + 60 * 60 * 1000) / 1000);
        console.error('coordinates')
        console.error(coordinates)
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

        const userName = data.user.profile.displayName;

        const emergencyInfo = {
            alarmClock: sounds.alarmClock,
            hospitalName: hospitalName,
            hospitalAddress: destination_addresses[0],
            userName: userName,
            userAddress: origin_addresses[0],
            coordinates: JSON.stringify(coordinates),
            durationTraffic: rows[0].elements[0].duration_in_traffic.text
        }

        // notify user's line group with contact info
        const contact = await callContact({
            to:'Rd4f5fe350b11d640e1a49dee3c95a2e9',
            message: {
                type: 'text',
                text: responses.contactNotify(emergencyInfo)
            },
            location: {
                type: 'location',
                title: `${userName}'s Location`,
                address: origin_addresses[0],
                ...coordinates,
            }
        });

        console.log('contact');
        console.log(contact);
        if (contact) {
            askAudio(agent, responses.emergencyNotify(emergencyInfo));
        }
    };

    const storeLine = (agent) => {
        console.error('storeLine')
        console.error(agent)
        agent.context.set({
            name: 'temperature',
            lifespan: 1,
            parameters:{temperature: 'temperature', unit: 'unit'}
        });

        let conv = agent.conv();
        console.error(JSON.stringify(conv, null, 4));
        // conv.request.user.storage.count = 1;
        // conv.request.user.storage.someProperty = 'someValue'
        agent.add(conv)
        console.error('agent')
        console.error(JSON.stringify(conv, null, 4));
        agent.add('storeLine sotre')
    };

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', welcome);
    // intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('actions_intent_PERMISSION', actionsIntentPermission);
    intentMap.set('link_line', line);
    intentMap.set('store_line', storeLine);

    // if requests for intents other than the default welcome and default fallback
    // is from the Google Assistant use the `googleAssistantOther` function
    // otherwise use the `other` function
    if (agent.requestSource === agent.ACTIONS_ON_GOOGLE) {
        console.error('google')
        // intentMap.set(null, googleAssistantOther);
    } else {
        console.error('other')
        // intentMap.set(null, other);
    }

    agent.handleRequest(intentMap);
});