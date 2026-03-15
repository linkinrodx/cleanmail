import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ImapConfig } from "../../shared/rpc-types";

type ImapSetupFormProps = {
	existingConfig: ImapConfig | null;
	onSave: (values: {
		host: string;
		port: number;
		username: string;
		password: string;
	}) => Promise<void>;
	onCancel?: () => void;
};

export function ImapSetupForm({
	existingConfig,
	onSave,
	onCancel,
}: ImapSetupFormProps) {
	const form = useForm({
		defaultValues: {
			host: existingConfig?.host ?? "",
			port: existingConfig?.port ?? 993,
			username: existingConfig?.username ?? "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await onSave(value);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				form.handleSubmit();
			}}
		>
			<FieldGroup>
				<form.Field
					name="host"
					validators={{
						onChange: ({ value }) =>
							!value.trim() ? "Host is required" : undefined,
					}}
				>
					{(field) => (
						<Field
							data-invalid={field.state.meta.errors.length > 0 || undefined}
						>
							<FieldLabel htmlFor={field.name}>IMAP Host</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								placeholder="imap.example.com"
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0 || undefined}
							/>
							<FieldDescription>
								Your IMAP server hostname or IP address.
							</FieldDescription>
							<FieldError
								errors={field.state.meta.errors.map((e) => ({
									message: String(e),
								}))}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="port"
					validators={{
						onChange: ({ value }) =>
							!value || value < 1 || value > 65535
								? "Port must be between 1 and 65535"
								: undefined,
					}}
				>
					{(field) => (
						<Field
							data-invalid={field.state.meta.errors.length > 0 || undefined}
						>
							<FieldLabel htmlFor={field.name}>Port</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="number"
								value={field.state.value}
								placeholder="993"
								onChange={(e) =>
									field.handleChange(parseInt(e.target.value, 10) || 0)
								}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0 || undefined}
							/>
							<FieldDescription>
								Use 993 for SSL/TLS (recommended) or 143 for STARTTLS.
							</FieldDescription>
							<FieldError
								errors={field.state.meta.errors.map((e) => ({
									message: String(e),
								}))}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="username"
					validators={{
						onChange: ({ value }) =>
							!value.trim() ? "Username is required" : undefined,
					}}
				>
					{(field) => (
						<Field
							data-invalid={field.state.meta.errors.length > 0 || undefined}
						>
							<FieldLabel htmlFor={field.name}>Username</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								value={field.state.value}
								placeholder="you@example.com"
								autoComplete="username"
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0 || undefined}
							/>
							<FieldError
								errors={field.state.meta.errors.map((e) => ({
									message: String(e),
								}))}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="password"
					validators={{
						onChange: ({ value }) =>
							!value ? "Password is required" : undefined,
					}}
				>
					{(field) => (
						<Field
							data-invalid={field.state.meta.errors.length > 0 || undefined}
						>
							<FieldLabel htmlFor={field.name}>Password</FieldLabel>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								value={field.state.value}
								placeholder={
									existingConfig ? "Leave empty to keep current" : "••••••••"
								}
								autoComplete="current-password"
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								aria-invalid={field.state.meta.errors.length > 0 || undefined}
							/>
							<FieldDescription>
								Stored securely in your system keychain.
							</FieldDescription>
							<FieldError
								errors={field.state.meta.errors.map((e) => ({
									message: String(e),
								}))}
							/>
						</Field>
					)}
				</form.Field>
			</FieldGroup>

			<DialogFooter className="mt-4">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Saving…" : "Save"}
						</Button>
					)}
				</form.Subscribe>
			</DialogFooter>
		</form>
	);
}
