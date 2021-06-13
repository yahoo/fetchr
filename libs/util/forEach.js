function forEach(object, fn) {
    for (var key in object) {
        if (object.hasOwnProperty(key)) {
            fn(object[key], key);
        }
    }
}

module.exports = forEach;
