const itemsData = {};

const itemsService = {
    resource: 'item',

    async create({ params, body }) {
        const item = {
            id: params.id,
            value: body.value,
        };
        itemsData[item.id] = item;
        return { data: item, meta: { statusCode: 201 } };
    },

    async read({ params }) {
        if (params.id) {
            const item = itemsData[params.id];
            if (!item) {
                const err = new Error('not found');
                err.statusCode = 404;
                return { err, meta: { foo: 42 } };
            } else {
                return { data: item, meta: { statusCode: 200 } };
            }
        } else {
            return {
                data: Object.values(itemsData),
                meta: { statusCode: 200 },
            };
        }
    },

    async update({ params, body }) {
        const item = itemsData[params.id];
        if (!item) {
            const err = new Error('not found');
            err.statusCode = 404;
            throw err;
        } else {
            const updatedItem = { ...item, ...body };
            itemsData[params.id] = updatedItem;
            return { data: updatedItem, meta: { statusCode: 201 } };
        }
    },

    async delete({ params }) {
        try {
            delete itemsData[params.id];
            return { data: null, meta: { statusCode: 200 } };
        } catch {
            const err = new Error('not found');
            err.statusCode = 404;
            throw err;
        }
    },
};

module.exports = {
    itemsData,
    itemsService,
};
