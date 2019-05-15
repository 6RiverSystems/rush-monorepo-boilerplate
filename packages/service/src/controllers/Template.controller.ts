import * as _ from 'lodash';
import * as Ajv from 'ajv';

import {inject} from '@loopback/context';
import {post, api, HttpErrors, RestBindings, requestBody, Response} from '@loopback/rest';

import {
	MinimalLogFactory,
	MinimalLogger,
} from '@sixriver/cfs_models';
import {ApiSchemaBuilder} from '@sixriver/wis-common';

import {TemplateMessage} from '@sixriver/template-oas';

import {ObjectIdModel, TemplateMessageModel} from '../models';
import {TemplateServiceProviderKeys} from '../providers';
import {Validator} from '../components';

const schemaBuilder = new ApiSchemaBuilder();
schemaBuilder.appendModel(TemplateMessageModel);

const EntityBasePath = '/template';

@api(schemaBuilder.createControllerApiDefinitions({
	basePath: '/v1',
	paths: {},
}))
export class TemplateController {
	private readonly logger: MinimalLogger;

	constructor(
		@inject(TemplateServiceProviderKeys.REQUEST_VALIDATOR)
		private readonly requestValidator: Validator<TemplateMessage, Ajv.ErrorObject>,
		@inject(RestBindings.Http.RESPONSE)
		private readonly response: Response,
		@inject(TemplateServiceProviderKeys.LOG_FACTORY)
		loggerFactory: MinimalLogFactory
	) {
		this.logger = loggerFactory(this.constructor.name);
	}

	@post(EntityBasePath, {
		responses: {
			'201': {
				description: 'Template accepted',
				content: {
					'application/json': {
						schema: {'x-ts-type': ObjectIdModel},
					},
				},
			},
		},
	})
	async create(
		@requestBody()
			message: TemplateMessageModel,
	): Promise<ObjectIdModel> {
		try {
			this.logger.info(
				{message: _.pick(message, 'id', 'timestamp', 'source', 'destinations')},
				'Received packout request',
			);

			const validationResult = await this.requestValidator.tryValidate(message);
			if (validationResult !== true) {
				return await this.handleInvalidRequest(message, validationResult);
			}

			this.response.statusCode = 201;

			return new ObjectIdModel({id: message.id});
		} catch (err) {
			// don't try to persist this error as an event, as it may have come from trying to persist an event
			this.logger.error({err}, 'Failed to ingest template message');
			throw err;
		}
	}

	// note that we take in the message as an any because, if we got here, we _know_ it is _not_ valid
	private async handleInvalidRequest(message: any, errors: any[]): Promise<never> {
		// remove any circular references and deep nested structures from the errors objects
		// having those causes many problems with both recording events and throwing the HTTP error later
		errors = safeErrors(errors);

		// TODO: we would like this to send a structured error, but that doesn't work when throwing an HttpError
		const err = new HttpErrors.UnprocessableEntity('Invalid template message received');
		err.details = {errors: errors.filter((e) => e !== null && e !== undefined).map((e) => ({
			message: e.message,
			...e,
		}))};
		this.logger.error({err}, err.message);
		throw err;
	}
}

function safeErrors<T>(object: T, maxDepth: number = 8): T {
	const depth = new Map<any, number>();
	const jsonString = JSON.stringify(object, function(this: any, key, value) {
		if (key.startsWith('_') || key.endsWith('_')) {
			return undefined;
		}
		if (_.isObject(value)) {
			if (value instanceof Error) {
				// errors need special handling else some of their properties dissapear
				value = {
					message: value.message,
					stack: value.stack,
					...value,
				};
			}
			// eslint-disable-next-line no-invalid-this
			const thisDepth = depth.get(this) || 0;
			let valueDepth = depth.get(value);
			if (valueDepth !== undefined) {
				return '[Circular]';
			} else if (thisDepth >= maxDepth && _.isObject(value)) {
				return '[Trimmed]';
			} else {
				valueDepth = thisDepth + 1;
				depth.set(value, valueDepth);
			}
		}
		return value;
	});
	return JSON.parse(jsonString);
}