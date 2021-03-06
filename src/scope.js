'use strict';

var _ = require('lodash');

function initWatchVal() { }

function Scope() {
	this.$$watchers = [];
	this.$$lastDirtyWatch = null;
	this.$$asyncQueue = [];
	this.$$applyAsyncQueue = [];
	this.$$applyAsyncId = null;
	this.$$phase = null;
}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
	var self = this;
	var watcher = {
		watchFn : watchFn,
		listenerFn : listenerFn || function() {},
		valueEq: !!valueEq,
		last : initWatchVal
	};

	this.$$watchers.unshift(watcher);
	this.$$lastDirtyWatch = null;

	return function() {
		// 相当于闭包，外部引用该匿名函数，使得$watch中的变量任然保持有效
		var index = self.$$watchers.indexOf(watcher);
		if (index >= 0) {
			self.$$watchers.splice(index, 1);
			self.$$lastDirtyWatch = null;
		}
	};
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
	if (valueEq) {
		return _.isEqual(newValue, oldValue);
	} else {
		return newValue === oldValue ||
			(typeof newValue === 'number' && typeof oldValue === 'number' &&
			 isNaN(newValue) && isNaN(oldValue));
	}
};

Scope.prototype.$$digestOnce = function() {
	var self = this;
	var newValue, oldValue, dirty;

	_.forEachRight(this.$$watchers, function(watcher) {
		try {
			if (watcher) {
				newValue = watcher.watchFn(self);
				oldValue = watcher.last;
				if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
					self.$$lastDirtyWatch = watcher;
					watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
					watcher.listenerFn(newValue, 
						oldValue === initWatchVal ? newValue : oldValue, self);
					dirty = true;
				} else if (self.$$lastDirtyWatch === watcher) {
					return false;
				}
			}
		} catch (e) {
			console.error(e);
		}
	});

	return dirty;
};

Scope.prototype.$digest = function() {
	var ttl = 10;
	var dirty;
	this.$$lastDirtyWatch = null;
	this.$beginPhase('$digest');

	if (this.$$applyAsyncId) {
		clearTimeout(this.$$applyAsyncId);
		this.$$flushApplyAsync();
	}

	do {
		while (this.$$asyncQueue.length) {
			var asyncTask = this.$$asyncQueue.shift();
			asyncTask.scope.$eval(asyncTask.expression);
		}

		dirty = this.$$digestOnce();
		if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
			this.$clearPhase();
			throw '10 digest iterations reached';
		}
	} while (dirty || this.$$asyncQueue.length);
	this.$clearPhase();
};



Scope.prototype.$eval = function(expr, locals) {
	return expr(this, locals);
};


Scope.prototype.$apply = function(expr) {
	try {
		this.$beginPhase('$apply');
		return this.$eval(expr);
	} finally {
		this.$clearPhase();
		this.$digest();
	}
};


// If you call $evalAsync when a digest is already running, your function will be evaluated during
// that digest. If there is no digest running, one is started.
Scope.prototype.$evalAsync = function(expr) {
	
	var self = this;
	if (!self.$$phase && !self.$$asyncQueue.length) {
		setTimeout(function() {
			if (self.$$asyncQueue.length) {
				self.$digest();
			}
		}, 0);
	}

	this.$$asyncQueue.push(
		{
			scope: this,
			expression: expr
		}
	);

};


Scope.prototype.$beginPhase = function(phase) {
	if (this.$$phase) {
		throw this.$$phase + ' already in progress.';
	} 

	this.$$phase = phase;
};


Scope.prototype.$clearPhase = function() {
	this.$$phase = null;
};


Scope.prototype.$$flushApplyAsync = function() {
	while (this.$$applyAsyncQueue.length) {
		this.$$applyAsyncQueue.shift()();
	}
	this.$$applyAsyncId = null;
};

Scope.prototype.$applyAsync = function(expr) {
	var self = this;
	self.$$applyAsyncQueue.push(function() {
		self.$eval(expr);
	});

	if (self.$$applyAsyncId === null) {
		self.$$applyAsyncId = setTimeout(function() {
			// 只调用一次$apply一次，将$$applyAsyncQueue的全部内容拿出来执行
			self.$apply(_.bind(self.$$flushApplyAsync, self));
		}, 0);
	}
};


module.exports = Scope;