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
    contactNotify: ({
        userName,
        userAddress,
        hospitalName,
        hospitalAddress,
        durationTraffic,
    }) => `
        Emergency Notification From ${userName}.
        ${userName} needs your help immediately!
        ${userName} is at "${userAddress}", the closest hospital is
        "${hospitalName}" at ${hospitalAddress} where is ${durationTraffic}.
        The hospital is ${durationTraffic} away to ${userName}'s location.
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