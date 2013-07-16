function Profiler() {
  this.times = []
  this.start = Date.now();
}

Profiler.prototype.done = function(what) {
  var now = Date.now();
  var elapsed = now - this.start;
  var item = { name:what, time:elapsed };
  this.times.push(item);
  this.start = Date.now()
}

Profiler.prototype.toString = function() {
  var sitems = [];
  var ttime = 0;
  for (var i=0; i<this.times.length; ++i) {
    var item = this.times[i];
    if ( item.time ) { // skip steps taking no computable time
      sitems.push(item.name + ':' + item.time);
      ttime += item.time;
    }
  }
  var s = 'TOT:'+ttime+';'+sitems.join(';');
  return s;
}

module.exports = Profiler;
