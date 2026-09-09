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
import { toast } from "sonner";
import { useAddAccountPassword } from "@/hooks/mutations/useAddAccountPassword";

type ImapSetupFormProps = {
	onAdded: () => void;
};

export function ImapSetupForm({ onAdded }: ImapSetupFormProps) {
	const { mutateAsync: addAccount, isPending } = useAddAccountPassword();

	const form = useForm({
		defaultValues: {
			email: "",
			host: "",
			port: 993,
			password: "",
		},
		onSubmit: async ({ value }) => {
			try {
				const result = await addAccount({
					provider: "custom",
					email: value.email,
					host: value.host,
					port: value.port,
					password: value.password,
				});
				if (result.success) {
					toast.success("Account added");
					onAdded();
				} else {
					toast.error(result.error ?? "Could not add the account");
				}
			} catch (err) {
				toast.error(
					err instanceof Error ? err.message : "Could not add the account",
				);
			}
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
					name="email"
					validators={{
						onChange: ({ value }) =>
							!value.trim() ? "Email is required" : undefined,
					}}
				>
					{(field) => (
						<Field
							data-invalid={field.state.meta.errors.length > 0 || undefined}
						>
							<FieldLabel htmlFor={field.name}>Email</FieldLabel>
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
								Your IMAP server hostname (e.g. imap.gmail.com).
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
								Use 993 for SSL/TLS (recommended).
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
								placeholder="••••••••"
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
				<form.Subscribe selector={(s) => s.isSubmitting || isPending}>
					{(submitting) => (
						<Button type="submit" disabled={submitting}>
							{submitting ? "Saving…" : "Add account"}
						</Button>
					)}
				</form.Subscribe>
			</DialogFooter>
		</form>
	);
}
