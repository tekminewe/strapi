const _ = require('lodash');
const pluralize = require('pluralize');

module.exports = async cb => {
  const pickData = (model) => _.pick(model, [
    'info',
    'connection',
    'collectionName',
    'attributes',
    'identity',
    'globalId',
    'globalName',
    'orm',
    'loadedModel',
    'primaryKey',
    'associations'
  ]);

  const pluginsLayout = Object.keys(strapi.plugins).reduce((acc, current) => {
    const models = _.get(strapi.plugins, [current, 'config', 'layout'], {});
    Object.keys(models).forEach(model => {
      const layout = _.get(strapi.plugins, [current, 'config', 'layout', model], {});
      acc[model] = layout;
    });

    return acc;
  }, {});
  const tempLayout = Object.keys(strapi.models)
    .filter(m => m !== 'core_store')
    .reduce((acc, current) => {
      acc[current] = { attributes: {} };

      return acc;
    }, pluginsLayout);
  const models = _.mapValues(strapi.models, pickData);
  delete models['core_store'];
  const pluginsModel = Object.keys(strapi.plugins).reduce((acc, current) => {
    acc[current] = {
      models: _.mapValues(strapi.plugins[current].models, pickData),
    };

    return acc;
  }, {});
  // Init schema
  const schema = {
    generalSettings: {
      search: true,
      filters: true,
      bulkActions: true,
      pageEntries: 10,
    },
    models: {
      plugins: {},
    },
    layout: {}
  };

  const buildSchema = (model, name, plugin = false) => {
    // Model data
    const schemaModel = Object.assign({
      label: _.upperFirst(name),
      labelPlural: _.upperFirst(pluralize(name)),
      orm: model.orm || 'mongoose',
      search: true,
      filters: true,
      bulkActions: true,
      pageEntries: 10,
      defaultSort: model.primaryKey,
      sort: 'ASC',
      editDisplay: {
        availableFields: {},
        fields: [],
        relations: [],
      },
    }, model);
    const fieldsToRemove = [];
    // Fields (non relation)
    const fields = _.mapValues(_.pickBy(model.attributes, attribute =>
      !attribute.model && !attribute.collection
    ), (value, attribute) => {
      const fieldClassName = _.get(tempLayout, [name, 'attributes', attribute, 'className'], '');

      if (fieldClassName === 'd-none') {
        fieldsToRemove.push(attribute);
      }

      return {
        label: _.upperFirst(attribute),
        description: '',
        type: value.type || 'string',
        disabled: false,
      };
    });

    if (model.orm === 'mongoose') {
      fields.createdAt = { label: 'createdAt', description: '', type: 'date', disabled: true };
      fields.updatedAt = { label: 'updatedAt', description: '', type: 'date', disabled: true };
      schemaModel.attributes.updatedAt = { type: 'date' };
      schemaModel.attributes.createdAt = { type: 'date' };
    } else {
      fields.created_at = { label: 'created_at', description: '', type: 'date', disabled: true };
      fields.updated_at = { label: 'updated_at', description: '', type: 'date', disabled: true };
      schemaModel.attributes.created_at = { type: 'date' };
      schemaModel.attributes.updated_at = { type: 'date' };
    }
    
    // Don't display fields that are hidden by default like the resetPasswordToken for the model user
    fieldsToRemove.forEach(field => {
      _.unset(fields, field);
      _.unset(schemaModel.attributes, field);
    });

    schemaModel.fields = fields;
    schemaModel.editDisplay.availableFields = fields;

    // Select fields displayed in list view
    schemaModel.listDisplay = Object.keys(schemaModel.fields)
      // Construct Array of attr ex { type: 'string', label: 'Foo', name: 'Foo', description: '' }
      .map(attr => {
        const attrType = schemaModel.fields[attr].type;
        const sortable = attrType !== 'json' && attrType !== 'array';

        return Object.assign(schemaModel.fields[attr], { name: attr, sortable, searchable: sortable });
      })
      // Retrieve only the fourth first items
      .slice(0, 4);

    schemaModel.listDisplay.splice(0, 0, {
      name: model.primaryKey || 'id',
      label: 'Id',
      type: 'string',
      sortable: true,
      searchable: true,
    });

    // This object will be used to customise the label and description and so on of an input.
    // TODO: maybe add the customBootstrapClass in it;
    schemaModel.editDisplay.availableFields = Object.keys(schemaModel.fields).reduce((acc, current) => {
      acc[current] = Object.assign(
        _.pick(_.get(schemaModel, ['fields', current], {}), ['label', 'type', 'description', 'name']),
        {
          editable: ['updatedAt', 'createdAt', 'updated_at', 'created_at'].indexOf(current) === -1,
          placeholder: '',
        });

      return acc;
    }, {});

    if (model.associations) {
      // Model relations
      schemaModel.relations = model.associations.reduce((acc, current) => {
        const label = _.upperFirst(current.alias);
        const displayedAttribute = current.plugin ? // Value to modified to custom what's displayed in the react-select
          _.get(pluginsModel, [current.plugin, 'models', current.model || current.collection, 'info', 'mainField']) ||
          _.findKey(_.get(pluginsModel, [current.plugin, 'models', current.model || current.collection, 'attributes']), { type : 'string'}) ||
          'id' :
          _.get(models, [current.model || current.collection, 'info', 'mainField']) ||
          _.findKey(_.get(models, [current.model || current.collection, 'attributes']), { type : 'string'}) ||
          'id';

        acc[current.alias] = {
          ...current,
          description: '',
          label,
          displayedAttribute,
        };

        return acc;
      }, {});
      const relationsArray = Object.keys(schemaModel.relations).filter(relation => {
        const isUploadRelation = _.get(schemaModel, ['relations', relation, 'plugin'], '') === 'upload';
        const isMorphSide = _.get(schemaModel, ['relations', relation, 'nature'], '').toLowerCase().includes('morp') &&  _.get(schemaModel, ['relations', relation, relation]) !== undefined;

        return !isUploadRelation && !isMorphSide;
      });

      const uploadRelations = Object.keys(schemaModel.relations).reduce((acc, current) => {
        if (_.get(schemaModel, ['relations', current, 'plugin']) === 'upload') {
          const model = _.get(schemaModel, ['relations', current]);

          acc[current] = {
            description: '',
            editable: true,
            label: _.upperFirst(current),
            multiple: _.has(model, 'collection'),
            name: current,
            placeholder: '',
            type: 'file',
            disabled: false,
          };
        }

        return acc;
      }, {});

      schemaModel.editDisplay.availableFields = _.merge(schemaModel.editDisplay.availableFields, uploadRelations);
      schemaModel.editDisplay.relations = relationsArray;
    }

    schemaModel.editDisplay.fields = Object.keys(schemaModel.editDisplay.availableFields);

    if (plugin) {
      return _.set(schema.models.plugins, `${plugin}.${name}`, schemaModel);
    }

    // Set the formatted model to the schema
    schema.models[name] = schemaModel;
  };

  _.forEach(pluginsModel, (plugin, pluginName) => {
    _.forEach(plugin.models, (model, name) => {
      buildSchema(model, name, pluginName);
    });
  });

  // Generate schema for models.
  _.forEach(models, (model, name) => {
    buildSchema(model, name);
  });

  const pluginStore = strapi.store({
    environment: '',
    type: 'plugin',
    name: 'content-manager'
  });

  const getApis = (data) => Object.keys(data).reduce((acc, curr) => {
    if (data[curr].fields) {
      return acc.concat([curr]);
    }

    if (curr === 'plugins') {
      Object.keys(data[curr]).map(plugin => {
        Object.keys(data[curr][plugin]).map(api => {
          acc = acc.concat([`${curr}.${plugin}.${api}`]);
        });
      });
    }

    return acc;
  }, []);
  const getApisKeys = (data, sameArray) => sameArray.map(apiPath => {
    const fields = Object.keys(_.get(data.models, apiPath.concat(['fields'])));

    return fields.map(field => `${apiPath.join('.')}.fields.${field}`);
  });
  const getApisUploadRelations = (data, sameArray) => sameArray.map(apiPath => {
    const relationPath = [...apiPath, 'relations'];
    const relationsObject = _.get(data.models, relationPath, {});
    const relations = Object.keys(relationsObject)
      .filter(relationName => {
        return _.get(data.models, [...relationPath, relationName, 'plugin' ]) === 'upload';
      });
    
    return relations.map(relation => `${apiPath.join('.')}.editDisplay.availableFields.${relation}`);
  });

  const getEditDisplayAvailableFieldsPath = attrPath => [..._.take(attrPath, attrPath.length -2), 'editDisplay', 'availableFields', attrPath[attrPath.length - 1]];
  const getEditDisplayFieldsPath = attrPath => [..._.take(attrPath, attrPath.length -2), 'editDisplay', 'fields'];

  try {
    const prevSchema = await pluginStore.get({ key: 'schema' });

    if (!prevSchema) {
      _.set(schema, 'layout', tempLayout);

      pluginStore.set({ key: 'schema', value: schema });

      return cb();
    }

    const splitted = str => str.split('.');
    const prevSchemaApis = getApis(prevSchema.models);
    const schemaApis = getApis(schema.models);
    const apisToAdd = schemaApis.filter(api => prevSchemaApis.indexOf(api) === -1).map(splitted);
    const apisToRemove = prevSchemaApis.filter(api => schemaApis.indexOf(api) === -1).map(splitted);
    const sameApis = schemaApis.filter(api => prevSchemaApis.indexOf(api) !== -1).map(splitted);
    const schemaSameApisKeys = _.flattenDeep(getApisKeys(schema, sameApis));
    const prevSchemaSameApisKeys = _.flattenDeep(getApisKeys(prevSchema, sameApis));
    const sameApisAttrToAdd = schemaSameApisKeys.filter(attr => prevSchemaSameApisKeys.indexOf(attr) === -1).map(splitted);
    const prevSchemaSameApisUploadRelations = _.flattenDeep(getApisUploadRelations(prevSchema, sameApis));
    const schemaSameApisUploadRelations = _.flattenDeep(getApisUploadRelations(schema, sameApis));
    const sameApisUploadRelationsToAdd = schemaSameApisUploadRelations.filter(attr => prevSchemaSameApisUploadRelations.indexOf(attr) === -1).map(splitted);
    const sameApisAttrToRemove = prevSchemaSameApisKeys.filter(attr => schemaSameApisKeys.indexOf(attr) === -1).map(splitted);

    // Remove api
    apisToRemove.map(apiPath => {
      _.unset(prevSchema.models, apiPath);
    });

    // Remove API attribute
    sameApisAttrToRemove.map(attrPath => {
      const editDisplayPath = getEditDisplayAvailableFieldsPath(attrPath);
      // Remove the field from the available fields in the editDisplayObject
      _.unset(prevSchema.models, editDisplayPath);
      // Check default sort and change it if needed
      _.unset(prevSchema.models, attrPath);
      const apiPath = attrPath.length > 3 ? _.take(attrPath, 3) : _.take(attrPath, 1);
      const listDisplayPath = apiPath.concat('listDisplay');
      const prevListDisplay = _.get(prevSchema.models, listDisplayPath);
      const defaultSortPath = apiPath.concat('defaultSort');
      const currentAttr = attrPath.slice(-1);
      const defaultSort = _.get(prevSchema.models, defaultSortPath);

      if (_.includes(currentAttr, defaultSort)) {
        _.set(prevSchema.models, defaultSortPath, _.get(schema.models, defaultSortPath));
      }

      // Update the displayed fields
      const updatedListDisplay = prevListDisplay.filter(obj => obj.name !== currentAttr.join());

      if (updatedListDisplay.length === 0) {
        // Update it with the one from the generaeted schema
        _.set(prevSchema.models, listDisplayPath, _.get(schema.models, listDisplayPath, []));
      } else {
        _.set(prevSchema.models, listDisplayPath, updatedListDisplay);
      }
    });

    // Add API
    apisToAdd.map(apiPath => {
      const api = _.get(schema.models, apiPath);
      const { search, filters, bulkActions, pageEntries } = _.get(prevSchema, 'generalSettings');

      _.set(api, 'filters', filters);
      _.set(api, 'search', search);
      _.set(api, 'bulkActions', bulkActions);
      _.set(api, 'pageEntries', pageEntries);
      _.set(prevSchema.models, apiPath, api);
    });

    // Add attribute to existing API
    sameApisAttrToAdd.map(attrPath => {
      const attr = _.get(schema.models, attrPath);
      _.set(prevSchema.models, attrPath, attr);

      // Add the field in the editDisplay object
      const path = getEditDisplayAvailableFieldsPath(attrPath);
      const availableAttrToAdd = _.get(schema.models, path);
      _.set(prevSchema.models, path, availableAttrToAdd);

      // Push the attr into the list
      const fieldsPath = getEditDisplayFieldsPath(attrPath);
      const currentFields = _.get(prevSchema.models, fieldsPath, []);
      currentFields.push(availableAttrToAdd.name);
      _.set(prevSchema.models, fieldsPath, currentFields);
    });

    // Update other keys
    sameApis.map(apiPath => {
      // This doesn't keep the prevSettings for the relations,  the user will have to reset it.
      // We might have to improve this if we want the order of the relations to be kept
      const keysToUpdate = ['relations', 'loadedModel', 'associations', 'attributes', ['editDisplay', 'relations']].map(key => apiPath.concat(key));

      keysToUpdate.map(keyPath => {
        const newValue = _.get(schema.models, keyPath);

        _.set(prevSchema.models, keyPath, newValue);
      });
    });

    // Special handler for the upload relations
    sameApisUploadRelationsToAdd.forEach(attrPath => {
      const attr = _.get(schema.models, attrPath);
      _.set(prevSchema.models, attrPath, attr);

      const fieldsPath = [..._.take(attrPath, attrPath.length -2), 'fields'];
      const currentFields = _.get(prevSchema.models, fieldsPath, []);
      currentFields.push(attr.name);
      _.set(prevSchema.models, fieldsPath, currentFields);
    });

    await pluginStore.set({ key: 'schema', value: prevSchema });
  } catch(err) {
    console.log('error', err);
  }

  cb();
};
