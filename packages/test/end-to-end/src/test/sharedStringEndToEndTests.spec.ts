/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import * as assert from "assert";
import { IFluidCodeDetails, ILoader } from "@microsoft/fluid-container-definitions";
import { Container } from "@microsoft/fluid-container-loader";
import { DocumentDeltaEventManager } from "@microsoft/fluid-local-driver";
import { SharedString } from "@microsoft/fluid-sequence";
import { LocalDeltaConnectionServer, ILocalDeltaConnectionServer } from "@microsoft/fluid-server-local-server";
import {
    createLocalLoader,
    ITestFluidComponent,
    initializeLocalContainer,
    TestFluidComponentFactory,
} from "@microsoft/fluid-test-utils";

describe("SharedString", () => {
    const id = "fluid-test://localhost/sharedStringtest";
    const codeDetails: IFluidCodeDetails = {
        package: "sharedStringTestPackage",
        config: {},
    };

    let deltaConnectionServer: ILocalDeltaConnectionServer;
    let containerDeltaEventManager: DocumentDeltaEventManager;
    let loader: ILoader;
    let component1: ITestFluidComponent;
    let component2: ITestFluidComponent;

    async function getComponent(componentId: string, container: Container): Promise<ITestFluidComponent> {
        const response = await container.request({ url: componentId });
        if (response.status !== 200 || response.mimeType !== "fluid/component") {
            throw new Error(`Component with id: ${componentId} not found`);
        }
        return response.value as ITestFluidComponent;
    }

    beforeEach(async () => {
        deltaConnectionServer = LocalDeltaConnectionServer.create();

        const factory = new TestFluidComponentFactory([[ "sharedString", SharedString.getFactory() ]]);
        loader = createLocalLoader([[ codeDetails, factory ]], deltaConnectionServer);


        const container1 = await initializeLocalContainer(id, loader, codeDetails);
        component1 = await getComponent("default", container1);

        const container2 = await initializeLocalContainer(id, loader, codeDetails);
        component2 = await getComponent("default", container2);

        containerDeltaEventManager = new DocumentDeltaEventManager(deltaConnectionServer);
        containerDeltaEventManager.registerDocuments(container1, container2);
    });

    it("can sync SharedString across multiple containers", async () => {
        const text = "syncSharedString";
        const sharedString1 = await component1.getSharedObject<SharedString>("sharedString");
        sharedString1.insertText(0, text);
        assert.equal(sharedString1.getText(), text, "The retrieved text should match the inserted text.");

        // Wait for the ops to to be submitted and processed across the containers.
        await containerDeltaEventManager.process();

        const sharedString2 = await component2.getSharedObject<SharedString>("sharedString");
        assert.equal(sharedString2.getText(), text, "The inserted text should have synced across the containers");
    });

    it("can sync SharedString to a newly loaded container", async () => {
        const text = "syncToNewConatiner";
        const sharedString1 = await component1.getSharedObject<SharedString>("sharedString");
        sharedString1.insertText(0, text);
        assert.equal(sharedString1.getText(), text, "The retrieved text should match the inserted text.");

        // Wait for the ops to to be submitted and processed across the containers.
        await containerDeltaEventManager.process();

        // Create a initialize a new container with the same id.
        const newContainer = await initializeLocalContainer(id, loader, codeDetails);
        const newComponent = await getComponent("default", newContainer);
        const newSharedString = await newComponent.getSharedObject<SharedString>("sharedString");
        assert.equal(newSharedString.getText(), text, "The new container should receive the inserted text on creation");
    });
});