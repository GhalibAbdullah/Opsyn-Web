import { EntitySchema } from 'typeorm'
import {
    ApIdSchema,
    BaseColumnSchemaPart,
} from '../database-common'

type AlertSchema = {
    id: string
    created: string
    updated: string
    projectId: string
    channel: string
    receiver: string
}

export const AlertEntity = new EntitySchema<AlertSchema>({
    name: 'alert',
    columns: {
        ...BaseColumnSchemaPart,
        projectId: {
            ...ApIdSchema,
        },
        channel: {
            type: String,
        },
        receiver: {
            type: String,
            nullable: false,
        },
    },
})
