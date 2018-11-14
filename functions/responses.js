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
            We've sent your information to your contacts.
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
    addLineCard: ({imageUrl, buttonUrl}) => ({
        title: `Setup your QrCode in Line APP of Urgent Helper`,
        text: `Please add it and create a room with your urgent contacts then \n
        type "get room id" in your chat room💁`,
        buttonText: 'Add Urgent Helper',
        imageUrl,
        buttonUrl,
    }),
    setLineSteps: `
        Following below's steps for setting up your line with google assistant \n
        Calling "store line" at google assistant and enter your room id \n
        then you will receive a notification from line when you set it up correctly
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
