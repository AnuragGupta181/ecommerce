import { Router, type Request, type Response } from "express";
import { idParam, requireVendorId } from "../../lib/http.js";
import { adminOnly, vendorOnly } from "../../middleware/auth.js";
import { platformWorkbook, reportQuery, resolveRange, vendorWorkbook } from "./reports.service.js";

function sendXlsx(res: Response, file: { filename: string; buffer: Buffer }) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.end(file.buffer);
}

/** Vendor portal: /vendor/reports/export?preset=this_month */
export const vendorReportsRouter = Router();
vendorReportsRouter.use(vendorOnly);
vendorReportsRouter.get("/export", async (req: Request, res: Response) => {
  sendXlsx(res, await vendorWorkbook(requireVendorId(req), resolveRange(reportQuery.parse(req.query))));
});

/** Admin: /admin/reports/platform, /admin/reports/vendors/:id */
export const adminReportsRouter = Router();
adminReportsRouter.use(adminOnly);
adminReportsRouter.get("/platform", async (req: Request, res: Response) => {
  sendXlsx(res, await platformWorkbook(resolveRange(reportQuery.parse(req.query))));
});
adminReportsRouter.get("/vendors/:id", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  sendXlsx(res, await vendorWorkbook(id, resolveRange(reportQuery.parse(req.query))));
});
