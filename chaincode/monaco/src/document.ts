import { IMap, MapExtension } from "@prague/map";
import { IRuntime } from "@prague/runtime-definitions";
import { CollaborativeStringExtension, SharedString } from "@prague/shared-string";
import * as uuid from "uuid/v4";

const rootMapId = "root";
const insightsMapId = "insights";

/**
 * A document is a collection of collaborative types.
 */
export class Document {
    public static async Load(runtime: IRuntime): Promise<Document> {
        let root: IMap;

        if (!runtime.existing) {
            root = runtime.createChannel(rootMapId, MapExtension.Type) as IMap;
            root.attach();

            const insights = runtime.createChannel(insightsMapId, MapExtension.Type);
            root.set(insightsMapId, insights);
        } else {
            root = await runtime.getChannel("root") as IMap;
        }

        const document = new Document(runtime, root);

        return document;
    }

    /**
     * Flag indicating whether the document already existed at the time of load
     */
    public get existing(): boolean {
        return this.runtime.existing;
    }

    /**
     * Constructs a new document from the provided details
     */
    private constructor(public runtime: IRuntime, private root: IMap) {
    }

    public getRoot(): IMap {
        return this.root;
    }

    /**
     * Creates a new collaborative map
     */
    public createMap(): IMap {
        return this.runtime.createChannel(uuid(), MapExtension.Type) as IMap;
    }

    /**
     * Creates a new collaborative string
     */
    public createString(): SharedString {
        return this.runtime.createChannel(uuid(), CollaborativeStringExtension.Type) as SharedString;
    }
}
