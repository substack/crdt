/*

  how to do security?

  simple way is to assume client-server.

  clients can only originate thier own messages.
  servers are trusted.

  if you start having untrusted servers, etc.
  will have to use crypto.

*/

var Stream = require('stream').Stream
var crdt = require('./index')
var utils = require('./utils')

var clone = utils.clone

module.exports = 
function create (set, name) {
  return createStream(set || new crdt.GSet('set'), name)
}

var _id = 0
function createStream(set, name) {

  if(!set)
    throw new Error('expected a collection CRDT')
  var s = new Stream()
  s._id = _id ++
  var sequence = 1
  //s.set = seex kt
  var queued = false
  var queue = []
  s.queue = queue
  s.readable = s.writable = true
  s.pipe = function (stream) {

    var dest = Stream.prototype.pipe.call(this, stream)

    //and now write the histroy!
    var hist = set.history()
    hist.sort(function (a, b) { 
      return a[2] - b[2]
    })

    console.log('################################')
    console.log(hist)
    console.log('################################')

    while(hist.length)
      queue.push(hist.shift()) 

    set.on('flush', function (updates) {
      updates.forEach(function (e) {
        queue.push(e)
      }) 
      process.nextTick(s.flush)
    })

  //emit data that has 
  set.on('written', function (update, _id) {
    if(_id == s._id) return
    queue.push(update)
    console.log('>>', update)
    process.nextTick(s.flush)
  })

   //got to defer writing the histroy,
    //because there may still be more downstream
    //pipes that are not connected yet!

    process.nextTick(s.flush)

    return dest
  }

  s.flush = function () {
    //if(!queue.length) 
    //set.flush()//force a flush, will emit and append to queue
    if(!queue.length)
      return

    //make sure the timestamps are in order
    queue.sort(function (a, b) {
      return a[2] - b[2]
    })

    while(queue.length) { 
      //this is breaking stuff in tests, because references are shared
      //with the test
      var update = clone(queue.shift())
      console.log(update)
      if(Array.isArray(update[1])) throw new Error('ARRAY IN WRONG PLACE')
      if(update) {
        update[3] = sequence++ // append sequence numbers for this oregin
        s.emit('data', update)
      }
    }
    
    queued = false
  }

  set.on('queue', function () {
    if(queue.length) return
    process.nextTick(s.flush)
  })

/*
******************************
WRITES FROM OTHER NODES MUST BE WRITTEN TO ALL LISTENERS.


******************************
*/

  s.write = function (update) {
    // [path, time, update]
    // hard code only one Set right now.
    var _update = clone(update)
    update[0].shift()
    set.update(update, s._id)

    // now is when it's time to emit events?
    /*
      apply local update with set(key, value)
      or set(obj)
      queue changes, then call flush()
      which adds the update to histroy and returns it.

    */

    //emit this so that other connections from this CRDT
    //and emit.
    //man, am doing a lot of this copying...
  //  console.log('>>',_update)
//    set.emit('written', _update, s._id)

    return true
  }

  //need to know if an event has come from inside
  //or outside...
  //should it be sent, or not? 
  //indeed, how to apply a local change?

  return s
}
