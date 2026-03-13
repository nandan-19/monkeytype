import { competeContract } from "@monkeytype/contracts/compete";
import { initServer } from "@ts-rest/express";
import { callController } from "../ts-rest-adapter";
import * as CompeteController from "../controllers/compete";

const s = initServer();
export default s.router(competeContract, {
  createRoom: {
    handler: async (r) => callController(CompeteController.createRoom)(r),
  },
  getRoom: {
    handler: async (r) => callController(CompeteController.getRoom)(r),
  },
});
