const express = require('express')
const app = express()
const http = require('http').createServer(app)
const io = require('socket.io')(http)
// const uuidv1 = require('uuid/v1')

app.use(express.static('public'))

// app.get('/', function(req, res){
//     res.sendFile(__dirname + '/public/index.html');
// })

// app.get('/js/socket.io.js', function(req, res){
//     res.sendFile(__dirname + '/public/js/socket.io.js');
// })


const TOTAL_NUMBER_OF_VIDEO_SEQ = 1

let DEVICES_CHECKED_IN = 0
let CURRENT_SEQUENCE_ID = 0
let CURRENT_CLIP_ID = 0
let CURRENT_DEVICE_ID = 0 // only used for testing

let DEVICES = [
    { status: 'open', leader: false },
    { status: 'open', leader: false },
    { status: 'open', leader: false }
]

const StartNewSeq = () => {
    CURRENT_SEQUENCE_ID = Math.floor(Math.random()*(TOTAL_NUMBER_OF_VIDEO_SEQ-1))
    console.log("ready to start video sequence", CURRENT_SEQUENCE_ID)
    io.emit('START_ALL', {seq_id:CURRENT_SEQUENCE_ID})
}

const PlayClip = () => {
    // Zero out leadership status on all devices
    DEVICES.forEach( device => {
        device.leader = false
    })
    // Choose a leader
    let leader_id = Math.floor(Math.random() * DEVICES.length)
    DEVICES[leader_id].leader = true
    console.log("elected device ", leader_id)

    // Send play command to leader and a few random bretheren
    DEVICES.forEach((device, index) => {
        if(device.leader == true){
            io.emit('PLAY',{device_id: index, seq_id: CURRENT_SEQUENCE_ID, clip_id: CURRENT_CLIP_ID})
            console.log("triggered leader ", index)
        }
        else {
             if((Math.random()*100)<30){
                io.emit('PLAY',{device_id: index, seq_id: CURRENT_SEQUENCE_ID, clip_id: CURRENT_CLIP_ID})
                console.log("triggered random device ", index)
             }
        }
    })

}

io.on('connection', (socket) => {
    console.log('new connection - socket id ', socket.id)

    socket.on('READY', () => {
        StartNewSeq()
    })

    socket.on('SEQ_PRELOADED', (data) => {
        console.log(data)
        DEVICES_CHECKED_IN++
        // check on the number of devices that reported
        if(DEVICES_CHECKED_IN == DEVICES.length){
            DEVICES_CHECKED_IN = 0
            PlayClip()

            // Test specific device
            //io.emit('PLAY',{device_id: CURRENT_DEVICE_ID, seq_id: CURRENT_SEQUENCE_ID, clip_id: CURRENT_CLIP_ID})
        }
    })

    socket.on("END_CLIP", (data)=>{
        console.log("clip " + CURRENT_CLIP_ID + " ended on device" + data.device_id)

        if(data.device_id == DEVICES.findIndex((device) => { return device.leader == true })){
            CURRENT_CLIP_ID++
            PlayClip()
        }
        // Test specific device
        // io.emit('PLAY',{device_id: CURRENT_DEVICE_ID, seq_id: CURRENT_SEQUENCE_ID, clip_id: CURRENT_CLIP_ID})
    })

    socket.on("END_SEQ", (data)=>{
        if(data.device_id == DEVICES.findIndex((device) => { return device.leader == true })){

            CURRENT_CLIP_ID = 0
            console.log("finished sequence: ", CURRENT_SEQUENCE_ID)
            io.emit('STOP')

            setTimeout(StartNewSeq, 500);
        }
    })


    socket.on('ENUMERATE', (fn) => {

        let index = DEVICES.findIndex((device) =>{
            return device.status === 'open'
        })

        console.log(index)

        if(index == -1){
            fn({
                'status':'error',
                'error_reason': 'No more spots left. Restart the server and try again to connect each phone again. Yes, this is VERY tedious. Sorry.'
            })
        }
        else {
            DEVICES[index].status = 'assigned'
            console.log("check", DEVICES.length)
            if(index===(DEVICES.length-1)){
                fn({
                    'status':'bus_ready',
                    'id': index
                })
            }
            else{
                fn({
                    'status':'success',
                    'id': index
                })
            }
        }
    });
});

io.on('disconnect', function(socket){
    console.log('disconnected - socket id ', socket.id)
})


http.listen(3000, function(){
    console.log('listening on *:3000');
});
