var sayHello = require('../src/hello');

describe('Hello', function() {
	it('says hello', function() {
		expect(sayHello("Liu")).toBe('Hello, Liu!');
	});
});