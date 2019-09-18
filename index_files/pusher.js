Enjin_Pusher = {
	pusher: null,
	is_ready: false,
	
	init: function() {
		this.is_ready = false;
	},
	
	setPusher: function(pusher) {
		this.pusher = pusher;
		
		//launch
		this.is_ready = true; 
		$(Enjin_Pusher).triggerEvent('onPusherReady');
	},
	
	getPusher: function() {
		return this.pusher;
	},

	getChannel: function(channel_name) {
		if (this.pusher.channel(channel_name)) {
			return this.pusher.channel(channel_name);
		} else {
			return this.pusher.subscribe(channel_name);
		}
	},
	
	onReady: function(fn) {
		if (this.is_ready) {
			fn.call(this);
		} else //queue
			$(Enjin_Pusher).bind('onPusherReady', fn);
	}
}

Enjin_Pusher.init();