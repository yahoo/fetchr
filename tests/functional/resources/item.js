const itemsData = {};

const itemsService = {
    resource: 'item',

    create(req, resource, params, body, config, callback) {
        const item = {
            id: params.id,
            value: body.value,
        };
        itemsData[item.id] = item;
        callback(null, item, { statusCode: 201 });
    },

    read(req, resource, params, config, callback) {
        if (params.id) {
            const item = itemsData[params.id];
            if (!item) {
                const err = new Error('not found');
                err.statusCode = 404;
                callback(err, null, { foo: 42 });
            } else {
                callback(null, item, { statusCode: 200 });
            }
        } else {
            callback(null, Object.values(itemsData), { statusCode: 200 });
        }
    },

    update(req, resource, params, body, config, callback) {
        const item = itemsData[params.id];
        if (!item) {
            const err = new Error('not found');
            err.statusCode = 404;
            callback(err);
        } else {
            const updatedItem = { ...item, ...body };
            itemsData[params.id] = updatedItem;
            callback(null, updatedItem, { statusCode: 201 });
        }
    },

    delete(req, resource, params, config, callback) {
        try {
            delete itemsData[params.id];
            callback(null, null, { statusCode: 200 });
        } catch (_) {
            const err = new Error('not found');
            err.statusCode = 404;
            callback(err);
        }
    },
};

module.exports = {
    itemsData,
    itemsService,
};
