const responses = {
    emergencyNotify: ({
        alarmClock,
        userName,
        userAddress,
        hospitalName,
        hospitalAddress,
        durationTraffic,
    }) => `
    <speak>Emergency Notification
        <audio src="${alarmClock}">emergency alarm</audio>
        <emphasis level="strong">
            Hi ${userName}, you are being helped.
            I've sent your information to your contacts.
            They will be helping you soon. Your location is at "${userAddress}",
            the closest hospital "${hospitalName}" is at ${hospitalAddress}
            where is ${durationTraffic} away to yours location.
            What happen?
        </emphasis>
    </speak>
    `,
    errorNotify: `
    <speak>
        Oh my god!
        <break time="1s"/>
        This has never happened before.
        Please Ask me again later.
    </speak>
    `,
};

module.exports = {responses};
