<script>
  import { STATUS_LABEL } from "../lib/constants.js";
  let { status } = $props();
</script>

<span class="status-badge s-{status}"><span class="sb-dot" aria-hidden="true"></span>{STATUS_LABEL[status]}</span>
