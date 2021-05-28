const { UserDetails, Suggestion, EventInfos } = require("../Models/meetCITADModel");
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken')
const transporter = require("../Middleware/mailer")

//User Sign in authentication
exports.userSignin = (req, res) => {
    const username = req.body.username
    const password = req.body.password

    UserDetails.findOne({username: username})
        .then(user => {
            const validPassword = bcrypt.compareSync(password, user.password)
            if (user && validPassword){
                const token = jwt.sign({user: user}, process.env.JWT_KEY, {expiresIn: "1h"})
                return res.json({
                    message: "Authentication Successfully",
                    User: user,
                    userToken: token
                })
            }
            res.json({message: "error, wrong credentials"})
            })
        .catch(err => console.log({error: err}))
}

//Create user
exports.createUser = (req, res) => {
    let username = req.body.username

    UserDetails.findOne({username: username})
        .then(user => {
            if (user && username === user.username) {
                return res.json({message: "Username already exist"})
            }
            else {
                const userInfo = {
                    fullname: req.body.fullname,
                    username: req.body.username,
                    email: req.body.email,
                    organisation: req.body.organisation,
                    password: bcrypt.hashSync(req.body.password, 10),
                    gender: req.body.gender
                }
                UserDetails.create(userInfo)
                    
                    .then(result => {
                        res.status(201).json(result)
                    })
                    .catch(error => res.status(202).json({message: `Data not created ${error}`}))
            }
        })
}

//Get all Users
exports.usersList = (req, res) => {
    UserDetails.find()
        .then(users => {
            res.json({
                Users: users
            })
        })
        .catch(err => res.json({
            error: err
        }))
}

//Get a single User
exports.getUser = (req, res) => {
    const username = req.params.username
    UserDetails.findOne({username})
        
        .then(user => {
            res.json(user)
        }).catch(err => res.json({message: "Cannot find the user"}))
}

//Update a single User
exports.updateUser = (req, res) => {
    const username = req.params.username

    const userInfoUpdate = {
        fullname: req.body.fullname,
        username: req.body.username,
        email: req.body.email,
        address: req.body.address,
        phone: req.body.phone,
        organisation: req.body.organisation,
        biography: req.body.biography,
        gender: req.body.gender,
        profileImage: req.file.path
    }
    UserDetails.findOneAndUpdate({username: username}, userInfoUpdate, {new: true})
        .then(updatedinfo => {
            res.json(updatedinfo)
        })
        .catch(error => console.log(`Can't update the record ${error}`)
        )
}

//Change Password
exports.changePassword = (req, res) => {
    const currentpassword = req.body.crtpassword
    const newPassword = req.body.password
    const hashPassword = bcrypt.hashSync(newPassword, 10)

    UserDetails.findOne({username: req.params.username})
        .then(user => {
        const validPassword = bcrypt.compareSync(currentpassword, user.password)

        if (user && validPassword) {
            UserDetails.updateOne({username: req.params.username}, {password: hashPassword})
                
                .then(result => {
                    res.json({message: "Password successfully changed"})
                }).catch(err => res.json({message: `${err}`}))
            }
        else {
            return res.json({message: "Please check the current password"})
        }
    })
    .catch(err=>{
        res.status(500).json({error: `${err}`})
    })
}

//Post Reset Password
exports.resetPassword = (req, res) => {
    const email = req.body.email
    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            return console.log(err)
        }
        const token = buffer.toString('hex')
        UserDetails.findOne({email: email}).then(user => {
            if (!user) {
                return res.json({message: "No User with such email."})
            }
            user.resetToken = token
            user.resetTokenExpiration = Date.now() + 3600000
            return user.save()
        })
        .then(response => {
            // transporter.sendMail({
            //     to: email,
            //     from: "citadorganisation@citad.org",
            //     subject: "Password Reset",
            //     html: `
            //         <div style="align: center">
            //             <h3>Reset your password?</h3>
            //             <p>If you requested a password reset, use the link below to complete the process. 
            //             If you didn't make this request, ignore this email.</p>
            //             <p> <a href="http://localhost:8080/reset-password/${token}"> Set new Password </a> </p>

            //             <p> <center>Thank you!!!</center> </p>
            //         </div>
            //     `
            // })
            console.log(response)
        })
        .catch(err => {
            res.json({message: err})
        })
    })
}

//Post New Password
exports.setNewPassword = (req, res) => {
    const passwordToken = req.params.token
    UserDetails.findOne({resetToken: passwordToken, resetTokenExpiration: {$gt: Date.now()}}).then(resetUser => {
        if (!resetUser) {
            console.log("Cannot find this user")
        }
        const newPassword = req.body.password
        let hashPassword = bcrypt.hashSync(newPassword, 10)

        resetUser.password = hashPassword
        resetUser.resetToken = undefined
        resetUser.resetTokenExpiration = undefined

        console.log(resetUser);
        return resetUser.save()
    })
    .then(res => {
        res.json({respons: res})
    })
    .catch(err => {
        res.json({error: err})
    })
}

//Post Registered Events
exports.registeredEvents = (req, res) => {
    const eventId = req.params.eventId
    const userId = req.body.userId
    
    UserDetails.findById({_id: userId}).then(user => {
        let email = user.email

        //Check whether there is registered event of user
        if (user.registeredEvent !== [] && user.registeredEvent.findIndex(ev => ev == eventId) >= 0){
            return res.json({message: "You already registered this event"})
        }else {
            user.registeredEvent.push({_id: eventId})
            user.attendance = false
            user.save()
            .then(result => {
            EventInfos.findById({_id: eventId}).then(eventData => {
                const eventDetail = {
                    title: eventData.title,
                    description: eventData.description,
                    location: eventData.venue,
                    date: eventData.date.toDateString()
                }
                //Sending Sucessful registration to user email
                // transporter.sendMail({
                //     to: email,
                //     from: "citadorganisation@citad.org",
                //     subject: "Registration Status",
                //     html: `
                //         <h3>You Successfully Registered for CITAD's Event </h3>
                //         <p>Which is ${eventDetail.title}: ${eventDetail.description} that will
                //             take place at ${eventDetail.location} on ${eventDetail.date.toString()}
                //         </p>

                //         <p>Thank You, We really appreciated and your attendance really matters.</p>
                //     `
                // })
                res.json({eventDetail, email})
                }).catch(err => {
                    console.log(err);
                })
            })
        }
    }).catch(err => res.json({error: `${err}`}))
}

//Delete Registered Events
exports.unRegisteredEvents = (req, res) => {
    const eventId = req.params.eventId
    const userId = req.body.userId

    UserDetails.findById({_id: userId}).then(user => {
        const registeredEvents = user.registeredEvent
        if (registeredEvents == [] && registeredEvents.findIndex(ev => ev == eventId) < 0) {
            return res.json({message: "No Registered event"})
        }
        if (user.registeredEvent.findIndex(ev => ev == eventId) >= 0){
            user.attendance = false
        }else {
            user.attendance = undefined
        }
        registeredEvents.splice(registeredEvents.findIndex(event => {
            event === eventId
        }), 1)
        return user.save()
        .then(() => res.json({
            message: "Successfully Unregistered"
        })).catch(err => {
            res.json({message: err})
        })
    }).catch(err => res.json({error: err}))
}

//Get Registered Events
exports.getRegisteredEvents = (req, res) => {
    UserDetails.findOne({_id: req.query.userId})
    .select("registeredEvent")
    .populate("registeredEvent", "title description venue time")    
        .then(user => {
            res.status(203).json(user)
        })
        .catch(err => res.json(`error while getting registered event ${err}`))
}


//Post Suggestion Message
exports.createSuggestion = (req, res) => {
    UserDetails.findOne({_id: req.body.userId})
    .then(user => {
        if(user){
            const suggestions = {
                email: req.body.email,
                comment: req.body.comment
            }

            Suggestion.create(suggestions)
            
            .then(resultmessage => {
                res.json(resultmessage),
                user.suggestionmessage.push(resultmessage)
                user.save()
            })
            .catch(err => res.json(`Cannot create ${err}`))
        }
        else {
            res.json({message: "No User with such id here"})
        }
    }).catch(err => console.error(err))
    
}

//Get Suggestion Message
exports.getSuggestion = (req, res) => {
    UserDetails.findOne({_id: req.query.userId}).populate("suggestionMessage")
    .then(user => {
        res.json({
            suggestion: user.suggestionMessage
        })
    })
    .catch(err => console.log('error while getting sent messages'))
}

