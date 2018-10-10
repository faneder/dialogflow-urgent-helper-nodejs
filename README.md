# Actions on Google: Urgent Helper using Node.js and Cloud Functions for Firebase

Urgent Helper helps wounded people to notify their urgent contact list and searches the closest hospital with patient information(Name, GPS, Address) immediately. It helps to allay the fears and concerns of patients, keeping them calm down and awake.

This built using Dialogflow and Node.js, this sample introduces asking for more than one permission for user information on the Actions on Google platform. After the user accesses the permission, we can get coordinates to find the closest hospital using Google Maps API. 

## Google Maps API

[Distance Matrix Service](https://developers.google.com/maps/documentation/distance-matrix/intro)
[Google Places API](https://developers.google.com/places/web-service/intro)

## Setup Instructions

See the developer guide and release notes at [https://developers.google.com/actions/](https://developers.google.com/actions/) for more details.

### Steps

### Option 1: Add to Dialogflow (recommended)
Click on the **Add to Dialogflow** button below and follow the prompts to create a new agent:

[![Urgent Helper](https://storage.googleapis.com/dialogflow-oneclick/deploy.svg "Urgent Helper")](https://console.dialogflow.com/api-client/oneclick?templateUrl=https%3A%2F%2Fstorage.googleapis.com%2Fdialogflow-oneclick%2urgent-helper.zip&agentName=ActionsOnGoogleUrgentHelper)

### Option 2: Dialogflow restore and Firebase CLI
1. Use the [Actions on Google Console](https://console.actions.google.com) to add a new project with a name of your choosing and click *Create Project*.
1. Click *Skip*, located on the top right to skip over category selection menu.
1. On the left navigation menu under *BUILD*, click on *Actions*. Click on *Add Your First Action* and choose your app's language(s).
1. Select *Custom intent*, click *BUILD*. This will open a Dialogflow console. Click *CREATE*.
1. Click on the gear icon to see the project settings.
1. Select *Export and Import*.
1. Select *Restore from zip*. Follow the directions to restore from the `urgent-helper.zip` in this repo.
1. Deploy the fulfillment webhook provided in the functions folder using [Google Cloud Functions for Firebase](https://firebase.google.com/docs/functions/):
   1. Follow the instructions to [set up and initialize Firebase SDK for Cloud Functions](https://firebase.google.com/docs/functions/get-started#set_up_and_initialize_functions_sdk). Make sure to select the project that you have previously generated in the Actions on Google Console and to reply `N` when asked to overwrite existing files by the Firebase CLI.
   1. Run `firebase deploy --only functions` and take note of the endpoint where the fulfillment webhook has been published. It should look like `Function URL (urgentHelper): https://${REGION}-${PROJECT}.cloudfunctions.net/urgentHelper`
1. Go back to the Dialogflow console and select *Fulfillment* from the left navigation menu. Enable *Webhook*, set the value of *URL* to the `Function URL` from the previous step, then click *Save*.

## Test on the Actions on Google simulator
1. Open [Dialogflow's *Integrations* page]((https://console.dialogflow.com/api-client/#/agent//integrations)), from the left navigation menu and open the *Integration Settings* menu for Actions on Google.
1. Enable *Auto-preview changes* and Click *Test*. This will open the Actions on Google simulator.
1. Click *View* to open the Actions on Google simulator.
1. Type `Talk to talk to dear urgent helper` in the simulator, or say `OK Google, talk to dear urgent helper` to any Actions on Google enabled device signed into your developer account.

For more detailed information on deployment, see the [documentation](https://developers.google.com/actions/dialogflow/deploy-fulfillment).

## References and How to report bugs
* Actions on Google documentation: [https://developers.google.com/actions/](https://developers.google.com/actions/).
* If you find any issues, please open a bug here on GitHub.
* Questions are answered on [StackOverflow](https://stackoverflow.com/questions/tagged/actions-on-google).

## How to make contributions?
Please read and follow the steps in the CONTRIBUTING.md.

## License
See LICENSE.md.

## Terms
Your use of this sample is subject to, and by using or downloading the sample files you agree to comply with, the [Google APIs Terms of Service](https://developers.google.com/terms/).

## Google+
Actions on Google Developers Community on Google+ [https://g.co/actionsdev](https://g.co/actionsdev).