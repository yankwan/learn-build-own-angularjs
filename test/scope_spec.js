'use strict';

var Scope = require('../src/scope');
var _ = require('lodash');

describe('Scope', function() {

	it('can be constructed and used as an object', function() {
		var scope = new Scope();
		scope.aProperty = 1;

		expect(scope.aProperty).toBe(1);
	});

	describe('digest', function() {

		var scope;

		beforeEach(function() {
			scope = new Scope();
		});

		it('calls the watch function with the scope as the argument', function() {
			var watchFn = jasmine.createSpy();
			var listenerFn = function() { };
			scope.$watch(watchFn, listenerFn);

			scope.$digest();
			expect(watchFn).toHaveBeenCalledWith(scope);
		});

		it('calls the listener function when the watched value changes', function() {
			scope.someValue = 'a';
			scope.counter = 0;

			scope.$watch(
				function(scope) { return scope.someValue; },
				function(newValue, oldValue, scope) { scope.counter++; }
			);

			expect(scope.counter).toBe(0);

			scope.$digest();
			expect(scope.counter).toBe(1);

			scope.someValue = 'b';
			expect(scope.counter).toBe(1);

			scope.$digest();
			expect(scope.counter).toBe(2);

		});

		it('calls listener when watch value is first undefined', function() {
			// 第一次调用scope.someValue为undefined
			// scope.last = initWatchVal, 实为一个函数引用
			// undefined !== initWatchVal 是一直成立的，所以第一次能够进入listenerFn
			// 如果scope.last不做处理也是undefined的话，则第一次无法进入listenerFn
			scope.counter = 0;
			scope.$watch(
				function(scope) { return scope.someValue; },
				function(newValue, oldValue, scope) { scope.counter++; }
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
		});


		it('calls listener with new value as old value the first time', function() {
			scope.someValue = 123;
			var oldValueGiven;
			scope.$watch(
				function(scope) { return scope.someValue; },
				function(newValue, oldValue, scope) { oldValueGiven = oldValue; }
			);
			scope.$digest();
			expect(oldValueGiven).toBe(123);
		});

		it('may have watchers that omit the listener function', function() {
			// 该条件下不传listenerFn导致调用$digest()抛出异常
			var watchFn = jasmine.createSpy().and.returnValue('something');
			scope.$watch(watchFn);
			scope.$digest();
			expect(watchFn).toHaveBeenCalled();
		});

		it('triggers chained watchers in the same digest', function() {
			scope.name = 'Jane';

			// 组装一个watcher对象扔进$$watchers
			scope.$watch(
				function(scope) { return scope.nameUpper; },
				function(newValue, oldValue, scope) {
					if (newValue) {
						scope.initial = newValue.substring(0, 1) + '.';
					}
				}
			);

			scope.$watch(
				function(scope) { return scope.name; },
				function(newValue, oldValue, scope) {
					if (newValue) {
						scope.nameUpper = newValue.toUpperCase();
					}
				}	
			);

			// $$watchers数组中保存连个watcher
			// 通过设置dirty标志位来判断每次循环中，是否全部监视的变量都没有再改变
			// 注意这里是只有还有一个watcher中监视的变量有变动，就会继续执行digest loop

			scope.$digest();
			expect(scope.initial).toBe('J.');

			scope.name = 'Bob';
			scope.$digest();
			expect(scope.initial).toBe('B.');
		});


		it('gives up on the watches after 10 iterations', function() {
			scope.counterA = 0;
			scope.counterB = 0;

			scope.$watch(
				function(scope) { return scope.counterA; },
				function(newValue, oldValue, scope) {
					scope.counterB++;
				}
			);

			scope.$watch(
				function(scope) { return scope.counterB; },
				function(newValue, oldValue, scope) {
					scope.counterA++;
				}
			);

			expect((function() { scope.$digest(); })).toThrow();
		});


		it('ends the digest when the last watch is clean', function() {
			scope.array = _.range(100);
			var watchExecutions = 0;
			_.times(100, function(i) {
				scope.$watch(
					function(scope) {
						watchExecutions++;
						return scope.array[i];
					},
					function(newValue, oldValue, scope) { }
				);
			});

			scope.$digest();
			expect(watchExecutions).toBe(200);

			scope.array[0] = 420;
			scope.$digest();
			expect(watchExecutions).toBe(301);
		});


		it('does not end digest so that new watches are not run', function() {
			scope.aValue = 'abc';
			scope.counter = 0;
			scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.$watch(
						function(scope) { return scope.aValue; },
						function(newValue, oldValue, scope) {
							scope.counter++;
						}
					);
				}
			);

			scope.$digest();
			expect(scope.counter).toBe(1);
		});

		it('compares based on value if enabled', function() {
			scope.aValue = [1, 2, 3];
			scope.counter = 0;
			scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				},
				true
			);

			scope.$digest();
			expect(scope.counter).toBe(1);

			scope.aValue.push(4);
			scope.$digest();
			expect(scope.counter).toBe(2);
		});


		it('correctly handles NaNs', function() {
			scope.number = 0/0; // NaN
			scope.counter = 0;
			scope.$watch(
				function(scope) { return scope.number; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);

			scope.$digest();
			expect(scope.counter).toBe(1);
			
			scope.$digest();
			expect(scope.counter).toBe(1);
		});


		it('catches exceptions in watch functions and continues', function() {
			scope.aValue = 'abc';
			scope.counter = 0;
			scope.$watch(
				function(scope) { throw 'Error'; },
				function(newValue, oldValue, scope) { }
			);

			scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);

			scope.$digest();
			expect(scope.counter).toBe(1);
		});
			

		it('catches exceptions in listener functions and continues', function() {
			scope.aValue = 'abc';
			scope.counter = 0;
			scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					throw 'Error';
				}
			);

			scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);

			scope.$digest();
			expect(scope.counter).toBe(1);
		});


		it('allows destroying a $watch with a removal function', function() {
			scope.aValue = 'abc';
			scope.counter = 0;

			// 返回一个函数，那么$watch应该要包装一个返回函数
			// destroyWatch指向这个函数，destroyWatch()就是调用$watch中的返回函数
			var destroyWatch = scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);

			scope.$digest();
			expect(scope.counter).toBe(1);

			scope.aValue = 'def';
			scope.$digest();
			expect(scope.counter).toBe(2);

			scope.aValue = 'ghi';
			destroyWatch();
			scope.$digest();
			expect(scope.counter).toBe(2);
		});

		it('allows destroying a $watch during digest', function() {
			scope.aValue = 'abc';
			var watchCalls = [];

			scope.$watch(
				function(scope) {
					watchCalls.push('first');
					return scope.aValue;
				}
			);

			var destroyWatch = scope.$watch(
				function(scope) {
					watchCalls.push('second');
					destroyWatch();
				}
			);


			scope.$watch(
				function(scope) {
					watchCalls.push('third');
					return scope.aValue;
				}
			);

			// 将$$watchers的添加方式更改为从数组头开始添加
			// 遍历从数组尾部开始遍历
			// 这样删除当前位置watcher后会向前一个位置偏移一位（向左偏移即下标小的位置）
			// 此时新指向的位置正好是下一个需要遍历的元素
			// 此处仍有疑问？？？？
			scope.$digest();
			expect(watchCalls).toEqual(['first', 'second', 'third', 'first', 'third']);
		});



		it('allows a $watch to destroy another during digest', function() {

			scope.aValue = 'abc';
			scope.counter = 0;

			scope.$watch(
				function(scope) {
					return scope.aValue;
				},
				function(newValue, oldValue, scope) {
					destroyWatch();
				}
			);

			var destroyWatch = scope.$watch(
				function(scope) { },
				function(newValue, oldValue, scope) { }
			);


			scope.$watch(
				function(scope) { return scope.aValue; },
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);

			// 执行$digest()方法前，3个watch都已经添加进$$watchers
			// 第一个watch执行listenerFn时才删除第二个watcher
			scope.$digest();
			expect(scope.counter).toBe(1);

		});


		it('allows destroying several $watches during digest', function() {
		  	scope.aValue = 'abc';
		  	scope.counter = 0;
			var destroyWatch1 = scope.$watch(
		  		function(scope) {
		    		destroyWatch1();
					destroyWatch2();
				}
			); 

			var destroyWatch2 = scope.$watch(
		  		function(scope) { return scope.aValue; },
		  		function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);

			scope.$digest();
		  	expect(scope.counter).toBe(0);
		});



	});
});